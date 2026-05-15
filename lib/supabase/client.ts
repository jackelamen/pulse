"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "@/lib/env";
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
  const { url, anonKey } = requireSupabaseEnv();

  return createBrowserClient<Database>(url, anonKey) as unknown as LooseSupabaseClient;
}
