/**
 * POST /api/push/notify
 *
 * Called by the service worker's alarm-check loop (via a fetch with the
 * user's auth cookie). Finds tasks with reminder_at in the next 2-minute
 * window, sends a Web Push notification to every registered subscription
 * for that user, then clears reminder_at so the same task doesn't fire
 * twice.
 *
 * The 2-minute window means the SW only needs to poll roughly every minute
 * without risk of missing a reminder that fires between polls.
 */

import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

type ReminderTask = { id: string; title: string; due_at: string | null; reminder_at: string | null };
type PushSub = { endpoint: string; p256dh: string; auth: string };

const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@theedgex.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function POST() {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 503 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 2 * 60 * 1000); // +2 minutes

  // Fetch tasks with a reminder due in the next 2 minutes.
  const { data: rawTasks, error: taskErr } = await supabase
    .from("tasks")
    .select("id, title, due_at, reminder_at")
    .eq("user_id", user.id)
    .is("completed_at", null)
    .is("deleted_at", null)
    .lte("reminder_at", windowEnd.toISOString())
    .order("reminder_at");
  const tasks = rawTasks as ReminderTask[] | null;

  if (taskErr) {
    console.error("[push/notify] task query:", taskErr);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ fired: 0 });
  }

  // Fetch all push subscriptions for this user.
  const { data: rawSubs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id);
  const subs = rawSubs as PushSub[] | null;

  if (!subs || subs.length === 0) {
    // No subscriptions — clear the reminders anyway so they don't accumulate.
    await clearReminders(supabase, tasks.map((t) => t.id));
    return NextResponse.json({ fired: 0, reason: "no subscriptions" });
  }

  let fired = 0;
  const staleEndpoints: string[] = [];

  for (const task of tasks) {
    const payload = JSON.stringify({
      title: task.title,
      body: task.due_at
        ? `Due ${formatDue(task.due_at)}`
        : "Reminder",
      taskId: task.id,
      url: "/today",
    });

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          fired++;
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          // 404 / 410 means the subscription is gone — mark for cleanup.
          if (status === 404 || status === 410) {
            staleEndpoints.push(sub.endpoint);
          } else {
            console.error("[push/notify] sendNotification:", err);
          }
        }
      })
    );
  }

  // Clear reminder_at so the same task doesn't fire again.
  await clearReminders(supabase, tasks.map((t) => t.id));

  // Remove stale subscriptions.
  if (staleEndpoints.length) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .in("endpoint", staleEndpoints);
  }

  return NextResponse.json({ fired });
}

async function clearReminders(
  supabase: ReturnType<typeof createClient>,
  ids: string[]
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("tasks") as any)
    .update({ reminder_at: null })
    .in("id", ids);
}

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
