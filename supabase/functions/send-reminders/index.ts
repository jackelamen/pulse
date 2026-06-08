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

// Build the application server (VAPID) once at cold start.
async function buildAppServer() {
  // @negrel/webpush expects the VAPID keys as a JWK pair. We import the raw
  // base64url keys the `web-push` npm tool generated.
  const vapidKeys = await webpush.importVapidKeys(
    {
      publicKey: VAPID_PUBLIC,
      privateKey: VAPID_PRIVATE,
    },
    { extractable: false },
  );
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

  const appServer = await buildAppServer();

  // Cache subscriptions per user so we don't re-query for users with many
  // simultaneously-due tasks.
  const subsByUser = new Map<string, PushSub[]>();
  const staleEndpoints: string[] = [];
  let fired = 0;

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

    if (subs.length === 0) continue;

    const payload = JSON.stringify({
      title: task.title,
      body: task.due_at ? `Due ${formatDue(task.due_at)}` : "Reminder",
      taskId: task.id,
      url: "/today",
    });

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          const subscriber = appServer.subscribe({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          });
          await subscriber.pushTextMessage(payload, {});
          fired++;
        } catch (err) {
          const status = (err as { statusCode?: number; status?: number })
            .statusCode ?? (err as { status?: number }).status;
          if (status === 404 || status === 410) {
            staleEndpoints.push(sub.endpoint);
          } else {
            console.error("[send-reminders] push:", err);
          }
        }
      }),
    );
  }

  // 3. Clear reminder_at so these never fire again.
  const taskIds = tasks.map((t) => t.id);
  const { error: clearErr } = await supabase
    .from("tasks")
    .update({ reminder_at: null })
    .in("id", taskIds);
  if (clearErr) console.error("[send-reminders] clear reminders:", clearErr);

  // 4. Remove dead subscriptions.
  if (staleEndpoints.length) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", staleEndpoints);
  }

  return new Response(
    JSON.stringify({ fired, tasks: tasks.length, stale: staleEndpoints.length }),
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
