import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnvStatus, requireSupabaseEnv } from "@/lib/env";
import { appUrl } from "@/lib/request-origin";
import type { Database } from "@/types/database";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/password", "/deployment-error", "/api/health"];
type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const envStatus = getSupabaseEnvStatus();
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!envStatus.ok) {
    if (path === "/deployment-error" || path.startsWith("/api/health")) {
      return response;
    }

    const url = appUrl("/deployment-error", request);
    url.searchParams.set("missing", envStatus.missing.join(","));
    return noStoreRedirect(url);
  }

  const { url: supabaseUrl, anonKey, cookieDomain } = requireSupabaseEnv();

  const supabase = createServerClient<Database>(
    supabaseUrl,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              domain: cookieDomain,
            } as CookieOptions)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser().catch((error) => {
    console.error("[pulse] middleware auth check failed", formatError(error));
    return { data: { user: null }, error };
  });

  if (authError) {
    console.error("[pulse] middleware auth error", formatError(authError));
  }

  if (!user && !isPublic) {
    const url = appUrl("/login", request);
    url.searchParams.set("next", path);
    return noStoreRedirect(url);
  }

  if (user && path === "/login") {
    const url = appUrl("/today", request);
    return noStoreRedirect(url);
  }

  return response;
}

function noStoreRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    };
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
