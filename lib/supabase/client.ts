"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type LooseTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: never[];
};

type LooseSchema = {
  Tables: Record<string, LooseTable>;
  Views: Record<string, never>;
  Functions: Record<string, never>;
};

type LooseDatabase = { public: LooseSchema };
type LooseSupabaseClient = SupabaseClient<
  LooseDatabase,
  "public",
  "public",
  LooseSchema,
  { PostgrestVersion: "12" }
>;

export function createClient(): LooseSupabaseClient {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as unknown as LooseSupabaseClient;
}
