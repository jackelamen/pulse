import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/request-origin";

/**
 * GET /auth/google/callback
 *
 * Google redirects here after consent with a one-time `code`. We:
 *   1. Exchange the code for tokens (access + refresh) server-side.
 *   2. Look up the Google account email (best-effort, for display).
 *   3. Upsert the refresh token into google_accounts for the current Pulse user.
 *
 * The refresh token never reaches the browser. It is written via the RLS-scoped
 * server client, so it lands on the signed-in user's own row only.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(appUrl(`/settings?google=denied`, request));
  }
  if (!code) {
    return NextResponse.redirect(appUrl(`/settings?google=denied`, request));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(appUrl("/settings?google=misconfigured", request));
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(appUrl("/login?next=/settings", request));
  }

  const redirectUri = appUrl("/auth/google/callback", request).toString();

  // ── Exchange the authorization code for tokens ────────────────────────────
  let tokens: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      return NextResponse.redirect(appUrl("/settings?google=exchange_failed", request));
    }
    tokens = await tokenRes.json();
  } catch {
    return NextResponse.redirect(appUrl("/settings?google=exchange_failed", request));
  }

  // Without a refresh token we cannot sync in the background. This happens if
  // the user previously granted access and Google skipped re-issuing it; the
  // prompt=consent on the start route is meant to prevent that.
  if (!tokens.refresh_token) {
    return NextResponse.redirect(appUrl("/settings?google=no_refresh_token", request));
  }

  // ── Best-effort: fetch the Google account email for display ───────────────
  let googleEmail: string | null = null;
  if (tokens.access_token) {
    try {
      const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (infoRes.ok) {
        const info = (await infoRes.json()) as { email?: string };
        googleEmail = info.email ?? null;
      }
    } catch {
      // non-fatal
    }
  }

  const accessExpiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  // ── Persist (upsert on user_id) ───────────────────────────────────────────
  // Cast matches the codebase convention for server-side writes (see
  // app/api/push/subscribe/route.ts) — the strict typed client otherwise
  // narrows the insert payload to never.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("google_accounts") as any).upsert(
    {
      user_id: user.id,
      google_email: googleEmail,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token ?? null,
      access_expires_at: accessExpiresAt,
      sync_enabled: true,
      last_error: null,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.redirect(appUrl("/settings?google=save_failed", request));
  }

  const response = NextResponse.redirect(appUrl("/settings?google=connected", request));
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
