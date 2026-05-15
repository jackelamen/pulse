import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requireSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const mode = String(formData.get("mode") || "signin");
  const next = sanitizeNext(String(formData.get("next") || "/today"));

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = mode === "signup" ? "/login" : next;
  redirectUrl.search = "";

  const response = NextResponse.redirect(redirectUrl);
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
        emailRedirectTo: `${request.nextUrl.origin}/auth/callback?next=${encodeURIComponent(next)}`,
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
}

function redirectWithMessage(request: NextRequest, message: string, status: "err" | "ok", next: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set(status, message);
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

function sanitizeNext(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/today";
  return value;
}
