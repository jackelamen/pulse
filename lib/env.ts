const REQUIRED_SUPABASE_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

type RequiredSupabaseEnvKey = (typeof REQUIRED_SUPABASE_ENV)[number];
type RuntimePulseEnv = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
};

declare global {
  interface Window {
    __PULSE_ENV__?: RuntimePulseEnv;
  }
}

export type SupabaseEnvStatus = {
  ok: boolean;
  missing: RequiredSupabaseEnvKey[];
  hasCookieDomain: boolean;
  supabaseUrlHost: string | null;
};

export function getSupabaseEnvStatus(): SupabaseEnvStatus {
  const env = getRuntimePulseEnv();
  const missing = REQUIRED_SUPABASE_ENV.filter((key) => !env[key]);
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;

  return {
    ok: missing.length === 0,
    missing,
    hasCookieDomain: Boolean(process.env.NEXT_PUBLIC_COOKIE_DOMAIN),
    supabaseUrlHost: supabaseUrl ? safeHost(supabaseUrl) : null,
  };
}

export function requireSupabaseEnv() {
  const status = getSupabaseEnvStatus();
  const env = getRuntimePulseEnv();

  if (!status.ok) {
    throw new Error(`Pulse deployment is missing required env vars: ${status.missing.join(", ")}`);
  }

  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    cookieDomain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined,
  };
}

export function getPublicPulseEnv(): Required<RuntimePulseEnv> {
  const env = getRuntimePulseEnv();

  return {
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  };
}

function getRuntimePulseEnv(): RuntimePulseEnv {
  return {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      (typeof window !== "undefined" ? window.__PULSE_ENV__?.NEXT_PUBLIC_SUPABASE_URL : undefined),
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      (typeof window !== "undefined" ? window.__PULSE_ENV__?.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined),
  };
}

function safeHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}
