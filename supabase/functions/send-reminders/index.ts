/**
 * Edge Function: send-reminders
 *
 * Server-side reminder dispatcher. Runs on a schedule (pg_cron, every minute)
 * and is the replacement for the old in-browser setInterval poller that lived
 * in public/sw.js. Because this runs on Supabase's servers, it fires reminders
 * whether or not Pulse is open on any device.
 *
 * Flow:
 *   1. Find every task (across ALL users) whose reminder_at is due
 *      (reminder_at <= now), not completed, not deleted.
 *   2. For each task, look up that user's push subscriptions and send a
 *      Web Push notification to each one.
 *   3. Clear reminder_at so the task never fires twice.
 *   4. Delete subscriptions that come back 404/410 (gone).
 *
 * Auth: invoked by pg_cron with the SERVICE ROLE key, so it bypasses RLS and
 * can read every user's tasks + subscriptions. It is NOT meant to be called
 * by browsers. A shared CRON_SECRET header guards against public invocation.
 *
 * Required function secrets (set via `supabase secrets set`):
 *   SUPABASE_URL                 (auto-provided in the Edge runtime)
 *   SUPABASE_SERVICE_ROLE_KEY    (auto-provided in the Edge runtime)
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT                (e.g. mailto:jack@theedgex.com)
 *   CRON_SECRET                  (any random string; must match the cron call)
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.3.0";

type ReminderTask = {
  id: string;
  user_id: string;
  title: string;
  due_at: string | null;
};

type PushSub = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:jack@theedgex.com";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

// ── VAPID key conversion ─────────────────────────────────────────────────────
//
// `web-push` (npm) emits VAPID keys as RAW base64url strings:
//   public  = 65 bytes, uncompressed P-256 point: 0x04 || X(32) || Y(32)
//   private = 32 bytes, the scalar `d`
//
// `@negrel/webpush`'s importVapidKeys() expects JWK objects (the output of its
// own exportVapidKeys()), NOT raw strings. Passing the raw strings throws and
// — because this is only reached when a reminder is actually due — that
// exception used to escape as an uncaught 500, leaving reminder_at uncleared so
// the same task re-crashed the function every minute. Convert explicitly.

function b64urlToBytes(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function bytesToB64url(bytes: Uint8Array): string {
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Deliberately omit `key_ops`/`ext`: if present they must agree with the usages
// the library requests on importKey, and omitting them imposes no constraint.
function rawVapidToJwk(publicRaw: string, privateRaw: string) {
  const pub = b64urlToBytes(publicRaw);
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error(
      `VAPID_PUBLIC_KEY must be a 65-byte uncompressed P-256 point (got ${pub.length} bytes, first byte 0x${pub[0]?.toString(16)})`,
    );
  }
  const x = bytesToB64url(pub.slice(1, 33));
  const y = bytesToB64url(pub.slice(33, 65));

  const priv = b64urlToBytes(privateRaw);
  if (priv.length !== 32) {
    throw new Error(`VAPID_PRIVATE_KEY must be 32 bytes (got ${priv.length})`);
  }
  const d = bytesToB64url(priv);

  return {
    publicKey: { kty: "EC", crv: "P-256", x, y },
    privateKey: { kty: "EC", crv: "P-256", x, y, d },
  };
}

// Build the application server (VAPID) once at cold start.
async function buildAppServer() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exported = rawVapidToJwk(VAPID_PUBLIC, VAPID_PRIVATE) as any;
  const vapidKeys = await webpush.importVapidKeys(exported, {
    extractable: false,
  });
  return await webpush.ApplicationServer.new({
    contactInformation: VAPID_SUBJECT,
    vapidKeys,
  });
}

Deno.serve(async (req) => {
  // Guard: only the scheduled caller (which knows CRON_SECRET) may invoke this.
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(
      JSON.stringify({ error: "VAPID keys not configured" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const nowIso = new Date().toISOString();

  // 1. Due reminders across ALL users.
  const { data: rawTasks, error: taskErr } = await supabase
    .from("tasks")
    .select("id, user_id, title, due_at")
    .is("completed_at", null)
    .is("deleted_at", null)
    .not("reminder_at", "is", null)
    .lte("reminder_at", nowIso)
    .order("reminder_at");

  if (taskErr) {
    console.error("[send-reminders] task query:", taskErr);
    return new Response(JSON.stringify({ error: "Query failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const tasks = (rawTasks ?? []) as ReminderTask[];
  if (tasks.length === 0) {
    return new Response(JSON.stringify({ fired: 0 }), {
      headers: { "content-type": "application/json" },
    });
  }

  let appServer;
  try {
    appServer = await buildAppServer();
  } catch (err) {
    // Surface the reason instead of letting it escape as an opaque 500.
    console.error("[send-reminders] VAPID setup failed:", err);
    return new Response(
      JSON.stringify({
        error: "VAPID setup failed",
        detail: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  // Cache subscriptions per user so we don't re-query for users with many
  // simultaneously-due tasks.
  const subsByUser = new Map<string, PushSub[]>();
  const staleEndpoints: string[] = [];
  let fired = 0;

  // Which due tasks are safe to clear reminder_at for. A task is safe to
  // clear once nothing about it is worth retrying: either a push actually
  // went out, the user has no subscriptions to try, or every attempt failed
  // permanently (404/410 - the endpoint is gone, retrying won't help). If a
  // push attempt failed for a transient reason (network blip, 5xx from the
  // push service, etc.) with no successful delivery, we leave reminder_at
  // alone so the next cron tick (a minute later) retries it instead of the
  // notification silently vanishing.
  const clearableTaskIds: string[] = [];
  const retryTaskIds: string[] = [];

  for (const task of tasks) {
    let subs = subsByUser.get(task.user_id);
    if (!subs) {
      const { data: rawSubs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", task.user_id);
      subs = (rawSubs ?? []) as PushSub[];
      subsByUser.set(task.user_id, subs);
    }

    if (subs.length === 0) {
      // Nothing to send to - no push to retry, safe to clear.
      clearableTaskIds.push(task.id);
      continue;
    }

    const payload = JSON.stringify({
      title: task.title,
      body: task.due_at ? `Due ${formatDue(task.due_at)}` : "Reminder",
      taskId: task.id,
      url: "/today",
    });

    let delivered = false;
    let hadTransientFailure = false;

    const results = await Promise.allSettled(
      subs.map(async (sub) => {
        const subscriber = appServer.subscribe({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        });
        await subscriber.pushTextMessage(payload, {});
      }),
    );

    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        fired++;
        delivered = true;
        return;
      }
      const err = result.reason;
      const status = (err as { statusCode?: number; status?: number })
        .statusCode ?? (err as { status?: number }).status;
      if (status === 404 || status === 410) {
        staleEndpoints.push(subs![i].endpoint);
      } else {
        hadTransientFailure = true;
        console.error("[send-reminders] push:", err);
      }
    });

    if (delivered || !hadTransientFailure) {
      // Either it went through somewhere, or every failure was permanent
      // (stale endpoint) - nothing left to retry.
      clearableTaskIds.push(task.id);
    } else {
      retryTaskIds.push(task.id);
    }
  }

  // 3. Clear reminder_at only for tasks that are actually done (delivered,
  // no subscriptions, or only permanent failures). Tasks with a transient
  // failure and zero successful deliveries keep their reminder_at so the
  // next run retries them.
  if (clearableTaskIds.length) {
    const { error: clearErr } = await supabase
      .from("tasks")
      .update({ reminder_at: null })
      .in("id", clearableTaskIds);
    if (clearErr) console.error("[send-reminders] clear reminders:", clearErr);
  }

  // 4. Remove dead subscriptions.
  if (staleEndpoints.length) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", staleEndpoints);
  }

  return new Response(
    JSON.stringify({
      fired,
      tasks: tasks.length,
      cleared: clearableTaskIds.length,
      retrying: retryTaskIds.length,
      stale: staleEndpoints.length,
    }),
    { headers: { "content-type": "application/json" } },
  );
});

function formatDue(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
