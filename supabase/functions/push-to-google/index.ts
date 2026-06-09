/**
 * Edge Function: push-to-google
 *
 * One-way calendar sync: pushes scheduled Pulse tasks OUT to Google Calendar.
 * Pulse is the source of truth; Google changes are never read back.
 *
 * Runs on a schedule (pg_cron) just like send-reminders. Each run:
 *   1. Finds tasks needing sync (google_sync_state in 'pending','delete_pending')
 *      across ALL users.
 *   2. Groups by user, loads that user's google_accounts row, refreshes the
 *      Google access token from the stored refresh token when needed.
 *   3. pending  -> create (no event id) or patch (has event id) the Google event.
 *      delete_pending -> delete the Google event (skip if no event id).
 *   4. Writes back google_event_id / google_synced_at / google_sync_state.
 *
 * Auth: invoked by pg_cron with the SERVICE ROLE key (bypasses RLS). Guarded by
 * a shared CRON_SECRET header — not meant to be called by browsers.
 *
 * Required function secrets (supabase secrets set ...):
 *   SUPABASE_URL                (auto)
 *   SUPABASE_SERVICE_ROLE_KEY   (auto)
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   CRON_SECRET                 (must match the cron call header)
 *
 * v1 scope: skips recurring tasks (recurrence_rule not null are never marked
 * pending by the client, but we also defensively skip them here).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const DEFAULT_DURATION_MIN = 30;

type SyncTask = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  start_at: string | null;
  due_at: string | null;
  duration_minutes: number | null;
  all_day: boolean;
  recurrence_rule: string | null;
  recurrence_parent_id: string | null;
  google_event_id: string | null;
  google_sync_state: string;
};

type GoogleAccount = {
  user_id: string;
  refresh_token: string;
  access_token: string | null;
  access_expires_at: string | null;
  target_calendar_id: string;
  sync_enabled: boolean;
};

// deno-lint-ignore no-explicit-any
function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Exchange a refresh token for a fresh access token. */
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.access_token as string) ?? null;
  } catch {
    return null;
  }
}

/**
 * Normalize a Pulse RRULE into the form Google's `recurrence` array wants:
 * an array of strings each prefixed with "RRULE:". Pulse stores rules like
 * "FREQ=WEEKLY;BYDAY=MO" (sometimes already prefixed). Returns undefined for
 * an empty/blank rule.
 */
function toRecurrenceArray(rule: string | null): string[] | undefined {
  if (!rule) return undefined;
  const trimmed = rule.trim();
  if (!trimmed) return undefined;
  const withPrefix = trimmed.toUpperCase().startsWith("RRULE:")
    ? trimmed
    : `RRULE:${trimmed}`;
  return [withPrefix];
}

/**
 * Map a Pulse task to a Google Calendar event resource.
 *
 * Recurring templates: we send ONE event with a `recurrence` array; Google
 * expands the series. The event's start/end define the FIRST occurrence and
 * its time-of-day/duration. A recurring template may anchor on due_at when it
 * has no start_at, so fall back to that for the anchor.
 */
function toGoogleEvent(task: SyncTask) {
  const recurrence = toRecurrenceArray(task.recurrence_rule);
  const anchorIso = task.start_at ?? task.due_at;

  // All-day → date-only start/end (end is exclusive next day).
  if (task.all_day && anchorIso) {
    const start = new Date(anchorIso);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = new Date(start.getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return {
      summary: task.title,
      description: task.notes ?? undefined,
      start: { date: startDate },
      end: { date: endDate },
      recurrence: recurrence ?? [],
    };
  }

  const start = new Date(anchorIso!);
  const durationMin = task.duration_minutes ?? DEFAULT_DURATION_MIN;
  const end = new Date(start.getTime() + durationMin * 60 * 1000);
  return {
    summary: task.title,
    description: task.notes ?? undefined,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    // Always send an explicit array (empty when not recurring) so a PATCH that
    // removes a repeat actually clears recurrence on the Google event — an
    // omitted field would leave the series intact.
    recurrence: recurrence ?? [],
  };
}

async function googleApi(
  accessToken: string,
  method: string,
  path: string,
  // deno-lint-ignore no-explicit-any
  body?: any,
): Promise<{ ok: boolean; status: number; json: any }> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // delete returns empty body
  }
  return { ok: res.ok, status: res.status, json };
}

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return jsonResponse({ error: "Google client not configured" }, 503);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Tasks needing sync across all users (bounded batch).
  const { data: rawTasks, error: taskErr } = await supabase
    .from("tasks")
    .select(
      "id, user_id, title, notes, start_at, due_at, duration_minutes, all_day, recurrence_rule, recurrence_parent_id, google_event_id, google_sync_state",
    )
    .in("google_sync_state", ["pending", "delete_pending"])
    .limit(200);

  if (taskErr) {
    console.error("[push-to-google] task query:", taskErr);
    return jsonResponse({ error: "Query failed" }, 500);
  }

  const tasks = (rawTasks ?? []) as SyncTask[];
  if (tasks.length === 0) return jsonResponse({ processed: 0 });

  // Cache account + live access token per user across this run.
  const accountByUser = new Map<string, GoogleAccount | null>();
  const tokenByUser = new Map<string, string | null>();

  let processed = 0;
  let skipped = 0;
  let errored = 0;

  for (const task of tasks) {
    // A materialized exception instance (single edited/completed occurrence) is
    // already covered by its recurring series in Google — don't create a
    // separate event for it. Clear the marker and move on.
    if (task.recurrence_parent_id) {
      await supabase.from("tasks").update({ google_sync_state: "none" }).eq("id", task.id);
      skipped++;
      continue;
    }

    // Load + cache the user's Google account.
    let account = accountByUser.get(task.user_id);
    if (account === undefined) {
      const { data } = await supabase
        .from("google_accounts")
        .select(
          "user_id, refresh_token, access_token, access_expires_at, target_calendar_id, sync_enabled",
        )
        .eq("user_id", task.user_id)
        .maybeSingle();
      account = (data as GoogleAccount) ?? null;
      accountByUser.set(task.user_id, account);
    }

    // No account or sync disabled → leave the marker; nothing to do this run.
    if (!account || !account.sync_enabled) {
      skipped++;
      continue;
    }

    // delete_pending with no event id → nothing exists in Google; clear it.
    if (task.google_sync_state === "delete_pending" && !task.google_event_id) {
      await supabase.from("tasks").update({ google_sync_state: "none" }).eq("id", task.id);
      processed++;
      continue;
    }

    // Get a live access token for this user (cache per run).
    let accessToken = tokenByUser.get(task.user_id);
    if (accessToken === undefined) {
      accessToken = await refreshAccessToken(account.refresh_token);
      tokenByUser.set(task.user_id, accessToken);
    }
    if (!accessToken) {
      await supabase
        .from("google_accounts")
        .update({ last_error: "Failed to refresh Google access token" })
        .eq("user_id", task.user_id);
      errored++;
      continue;
    }

    const cal = encodeURIComponent(account.target_calendar_id || "primary");

    try {
      if (task.google_sync_state === "delete_pending") {
        const r = await googleApi(
          accessToken,
          "DELETE",
          `/calendars/${cal}/events/${task.google_event_id}`,
        );
        // 410/404 mean it's already gone — treat as success.
        if (r.ok || r.status === 404 || r.status === 410) {
          await supabase
            .from("tasks")
            .update({ google_event_id: null, google_sync_state: "none", google_synced_at: new Date().toISOString() })
            .eq("id", task.id);
          processed++;
        } else {
          await supabase.from("tasks").update({ google_sync_state: "error" }).eq("id", task.id);
          errored++;
        }
        continue;
      }

      // pending: create or patch. Anchor is start_at, or due_at for a
      // recurring template that only carries a due date.
      const anchorIso = task.start_at ?? (task.recurrence_rule ? task.due_at : null);
      if (!anchorIso) {
        // Unscheduled but marked pending — nothing to create. Clear it.
        await supabase.from("tasks").update({ google_sync_state: "none" }).eq("id", task.id);
        processed++;
        continue;
      }

      const event = toGoogleEvent(task);
      if (task.google_event_id) {
        const r = await googleApi(
          accessToken,
          "PATCH",
          `/calendars/${cal}/events/${task.google_event_id}`,
          event,
        );
        if (r.ok) {
          await supabase
            .from("tasks")
            .update({ google_sync_state: "synced", google_synced_at: new Date().toISOString() })
            .eq("id", task.id);
          processed++;
        } else if (r.status === 404 || r.status === 410) {
          // Event vanished in Google — recreate next run.
          await supabase
            .from("tasks")
            .update({ google_event_id: null, google_sync_state: "pending" })
            .eq("id", task.id);
          errored++;
        } else {
          await supabase.from("tasks").update({ google_sync_state: "error" }).eq("id", task.id);
          errored++;
        }
      } else {
        const r = await googleApi(accessToken, "POST", `/calendars/${cal}/events`, event);
        if (r.ok && r.json?.id) {
          await supabase
            .from("tasks")
            .update({
              google_event_id: r.json.id,
              google_sync_state: "synced",
              google_synced_at: new Date().toISOString(),
            })
            .eq("id", task.id);
          processed++;
        } else {
          await supabase.from("tasks").update({ google_sync_state: "error" }).eq("id", task.id);
          errored++;
        }
      }
    } catch (e) {
      console.error("[push-to-google] task", task.id, e);
      await supabase.from("tasks").update({ google_sync_state: "error" }).eq("id", task.id);
      errored++;
    }
  }

  return jsonResponse({ processed, skipped, errored, total: tasks.length });
});
