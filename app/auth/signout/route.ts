import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/request-origin";

export async function POST(request: Request) {
  const supabase = createClient();
  await supabase.auth.signOut();
  const response = NextResponse.redirect(appUrl("/login", request), { status: 303 });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
