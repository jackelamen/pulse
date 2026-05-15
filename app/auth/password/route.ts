import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requireSupabaseEnv } from "@/lib/env";
import { appOrigin, appUrl } from "@/lib/request-origin";
import type { Database } from "@/types/database";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const mode = String(formData.get("mode") || "signin");
    const next = sanitizeNext(String(formData.get("next") || "/today"));

    const redirectUrl = appUrl(mode === "signup" ? "/login" : next, request);

    const response = noStoreRedirect(redirectUrl);
    const { url, anonKey, cookieDomain } = requireSupabaseEnv();

    const supabase = createServerClient<Database>(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              domain: cookieDomain,
            } as CookieOptions);
          });
        },
      },
    });

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${appOrigin(request)}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (error) return redirectWithMessage(request, error.message, "err", next);
      if (data.session) return response;
      return redirectWithMessage(request, "Account created. Check your email to confirm it, then sign in.", "ok", next);
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return redirectWithMessage(request, error.message, "err", next);
    }

    return response;
  } catch (error) {
    console.error("[pulse] password auth failed", formatError(error));
    return redirectWithMessage(request, "Could not sign in. Check the runtime logs for details.", "err", "/today");
  }
}

export function GET(request: NextRequest) {
  return redirectWithMessage(request, "Use the sign in form below.", "err", "/today");
}

function redirectWithMessage(request: NextRequest, message: string, status: "err" | "ok", next: string) {
  const url = appUrl("/login", request);
  url.searchParams.set(status, message);
  url.searchParams.set("next", next);
  return noStoreRedirect(url);
}

function sanitizeNext(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/today";
  return value;
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
