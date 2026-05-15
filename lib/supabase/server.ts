import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
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
  const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
