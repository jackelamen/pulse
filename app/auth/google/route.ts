import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/request-origin";

/**
 * GET /auth/google
 *
 * Starts the Google OAuth flow for Calendar sync. Redirects the browser to
 * Google's consent screen requesting OFFLINE access to the Calendar events
 * scope, so Google returns a refresh token we can use for background sync.
 *
 * The redirect_uri is derived from the current request origin so it works in
 * dev (localhost:3000) and prod without hardcoding. Whatever origin this runs
 * on, the matching "/auth/google/callback" URI must be registered in the
 * Google Cloud OAuth client.
 */
export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(appUrl("/settings?google=misconfigured", request));
  }

  // Must be signed in to Pulse — we link Google to the current Pulse user.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(appUrl("/login?next=/settings", request));
  }

  const redirectUri = appUrl("/auth/google/callback", request).toString();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    // calendar.events = create/update/delete events.
    // calendar.calendarlist.readonly = enumerate the user's calendars so the
    // Settings picker can list more than just primary.
    scope:
      "https://www.googleapis.com/auth/calendar.events " +
      "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    access_type: "offline",
    // Force a consent prompt so Google reliably returns a refresh token even on
    // a re-link (it otherwise omits it after the first grant).
    prompt: "consent",
    include_granted_scopes: "true",
  });

  const consentUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  const response = NextResponse.redirect(consentUrl);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
