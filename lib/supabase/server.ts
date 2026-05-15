import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Server-side Supabase client.
 *
 * Cookie scoping for cross-subdomain auth (theedgex.com <-> tasks.theedgex.com):
 * set NEXT_PUBLIC_COOKIE_DOMAIN=".theedgex.com" in production env.
 * Leaving it unset keeps cookies host-only, which is what you want in dev.
 */
export function createClient() {
  const cookieStore = cookies();
  const { url, anonKey, cookieDomain } = requireSupabaseEnv();

  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                domain: cookieDomain,
              } as CookieOptions)
            );
          } catch {
            // Called from a Server Component — middleware will refresh on next request.
          }
        },
      },
    }
  );
}
