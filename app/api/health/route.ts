import { NextResponse } from "next/server";
import { getSupabaseEnvStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  const status = getSupabaseEnvStatus();

  return NextResponse.json({
    ok: status.ok,
    app: "pulse",
    supabaseUrlHost: status.supabaseUrlHost,
    missing: status.missing,
    hasCookieDomain: status.hasCookieDomain,
    nodeEnv: process.env.NODE_ENV,
  });
}
