const REQUIRED_SUPABASE_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

type RequiredSupabaseEnvKey = (typeof REQUIRED_SUPABASE_ENV)[number];

export type SupabaseEnvStatus = {
  ok: boolean;
  missing: RequiredSupabaseEnvKey[];
  hasCookieDomain: boolean;
  supabaseUrlHost: string | null;
};

export function getSupabaseEnvStatus(): SupabaseEnvStatus {
  const missing = REQUIRED_SUPABASE_ENV.filter((key) => !process.env[key]);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return {
    ok: missing.length === 0,
    missing,
    hasCookieDomain: Boolean(process.env.NEXT_PUBLIC_COOKIE_DOMAIN),
    supabaseUrlHost: supabaseUrl ? safeHost(supabaseUrl) : null,
  };
}

export function requireSupabaseEnv() {
  const status = getSupabaseEnvStatus();

  if (!status.ok) {
    throw new Error(`Pulse deployment is missing required env vars: ${status.missing.join(", ")}`);
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    cookieDomain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined,
  };
}

function safeHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}
