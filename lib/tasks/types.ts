import type { Database, Priority, TaskStatus } from "@/types/database";

export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

export type { Priority, TaskStatus };

/**
 * The fields the user is allowed to edit from the UI. user_id, timestamps,
 * sort_order, etc. are managed server-side or by the data layer itself.
 */
export type TaskEditableFields = Partial<
  Pick<
    Task,
    | "title"
    | "notes"
    | "priority"
    | "status"
    | "list_id"
    | "start_at"
    | "due_at"
    | "duration_minutes"
    | "all_day"
    | "tags"
  >
>;

/**
 * Result of parsing a quick-add string. The parser strips date/priority/tag
 * tokens from the title and returns them separately.
 */
export interface ParsedQuickAdd {
  title: string;
  start_at: string | null;
  due_at: string | null;
  duration_minutes: number | null;
  priority: Priority;
  tags: string[];
}

export type ScopeKey =
  | { kind: "today" }
  | { kind: "inbox" }
  | { kind: "upcoming" }
  | { kind: "list"; listId: string }
  | { kind: "logbook" };
