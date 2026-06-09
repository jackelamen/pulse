import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/google/sync
 *
 * "Sync now" — triggers the push-to-google Edge Function immediately instead
 * of waiting for the 2-minute cron. The Edge Function is guarded by a shared
 * CRON_SECRET that must never reach the browser, so the browser calls this
 * server route, which holds the secret and forwards the call.
 *
 * Requires a signed-in Pulse user. The Edge Function itself processes all
 * users' pending rows (same as the cron run), so this just kicks it off.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!supabaseUrl || !cronSecret) {
    return NextResponse.json(
      { error: "Sync is not configured on the server" },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/push-to-google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
      },
      body: "{}",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Sync function returned an error" },
        { status: 502 }
      );
    }
    const result = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ error: "Could not reach sync function" }, { status: 502 });
  }
}
