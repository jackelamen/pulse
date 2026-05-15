import type { Database, FocusMode } from "@/types/database";

export type FocusSession = Database["public"]["Tables"]["focus_sessions"]["Row"];
export type FocusSessionInsert = Database["public"]["Tables"]["focus_sessions"]["Insert"];
export type FocusSessionUpdate = Database["public"]["Tables"]["focus_sessions"]["Update"];

export type { FocusMode };
