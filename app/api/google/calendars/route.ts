import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/google/calendars
 *
 * Lists the signed-in user's Google calendars so the Settings picker can offer
 * a target other than "primary". Runs server-side: it reads the user's refresh
 * token (never exposed to the browser), mints a short-lived access token, and
 * calls Google's calendarList endpoint. Returns only id + summary + primary.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Google not configured" }, { status: 503 });
  }

  // Read this user's refresh token (RLS scopes to the current user).
  const { data: account, error } = await supabase
    .from("google_accounts")
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !account) {
    return NextResponse.json({ error: "Google not connected" }, { status: 404 });
  }

  const refreshToken = (account as { refresh_token: string }).refresh_token;

  // Mint a fresh access token.
  let accessToken: string | null = null;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (tokenRes.ok) {
      const json = (await tokenRes.json()) as { access_token?: string };
      accessToken = json.access_token ?? null;
    }
  } catch {
    accessToken = null;
  }
  if (!accessToken) {
    return NextResponse.json({ error: "Could not authorize with Google" }, { status: 502 });
  }

  // Fetch the calendar list.
  try {
    const listRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!listRes.ok) {
      return NextResponse.json({ error: "Could not list calendars" }, { status: 502 });
    }
    const data = (await listRes.json()) as {
      items?: Array<{ id: string; summary: string; primary?: boolean }>;
    };
    const calendars = (data.items ?? []).map((c) => ({
      id: c.id,
      summary: c.summary,
      primary: !!c.primary,
    }));
    return NextResponse.json({ calendars });
  } catch {
    return NextResponse.json({ error: "Could not list calendars" }, { status: 502 });
  }
}
