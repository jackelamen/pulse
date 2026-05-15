/**
 * Pulse database types.
 *
 * Hand-written for M0/M1. Once the schema stabilizes, regenerate from Supabase
 * with: `npx supabase gen types typescript --project-id mdkyijbgvxedelcqcouu`.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type Priority = 0 | 1 | 2 | 3;
export type ListViewMode = "list" | "board" | "timeline";
export type FocusMode = "pomodoro" | "flow" | "custom";
export type HabitCadence = "daily" | "weekdays" | "weekly" | "custom";
type AnyRecord = Record<string, unknown>;
type SupabaseTable = {
  Row: AnyRecord;
  Insert: AnyRecord;
  Update: AnyRecord;
  Relationships: Array<{
    foreignKeyName: string;
    columns: string[];
    isOneToOne?: boolean;
    referencedRelation: string;
    referencedColumns: string[];
  }>;
};

export interface Database {
  public: {
    Tables: {
      [key: string]: SupabaseTable;
      lists: {
        Row: {
          id: string;
          user_id: string;
          folder_id: string | null;
          name: string;
          color: string | null;
          icon: string | null;
          view_mode: ListViewMode;
          sort_order: number;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        } & AnyRecord;
        Insert: {
          id?: string;
          user_id?: string;
          folder_id?: string | null;
          name: string;
          color?: string | null;
          icon?: string | null;
          view_mode?: ListViewMode;
          sort_order?: number;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        } & AnyRecord;
        Update: Partial<Database["public"]["Tables"]["lists"]["Insert"]> & AnyRecord;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          list_id: string | null;
          parent_task_id: string | null;
          title: string;
          notes: string | null;
          priority: Priority;
          status: TaskStatus;
          start_at: string | null;
          due_at: string | null;
          duration_minutes: number | null;
          all_day: boolean;
          completed_at: string | null;
          recurrence_rule: string | null;
          recurrence_parent_id: string | null;
          sort_order: number;
          tags: string[];
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        } & AnyRecord;
        Insert: {
          id?: string;
          user_id?: string;
          list_id?: string | null;
          parent_task_id?: string | null;
          title: string;
          notes?: string | null;
          priority?: Priority;
          status?: TaskStatus;
          start_at?: string | null;
          due_at?: string | null;
          duration_minutes?: number | null;
          all_day?: boolean;
          completed_at?: string | null;
          recurrence_rule?: string | null;
          recurrence_parent_id?: string | null;
          sort_order?: number;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        } & AnyRecord;
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]> & AnyRecord;
        Relationships: [];
      };
      folders: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          sort_order: number;
          collapsed: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        } & AnyRecord;
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          sort_order?: number;
          collapsed?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        } & AnyRecord;
        Update: Partial<Database["public"]["Tables"]["folders"]["Insert"]> & AnyRecord;
        Relationships: [];
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string | null;
          created_at: string;
          updated_at: string;
        } & AnyRecord;
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        } & AnyRecord;
        Update: Partial<Database["public"]["Tables"]["tags"]["Insert"]> & AnyRecord;
        Relationships: [];
      };
      focus_sessions: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          started_at: string;
          ended_at: string | null;
          planned_minutes: number;
          actual_minutes: number | null;
          mode: FocusMode;
          interruptions: number;
          note: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        } & AnyRecord;
        Insert: {
          id?: string;
          user_id?: string;
          task_id?: string | null;
          started_at: string;
          ended_at?: string | null;
          planned_minutes?: number;
          actual_minutes?: number | null;
          mode?: FocusMode;
          interruptions?: number;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        } & AnyRecord;
        Update: Partial<Database["public"]["Tables"]["focus_sessions"]["Insert"]> & AnyRecord;
        Relationships: [];
      };
      habits: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          cadence: HabitCadence;
          cadence_config: Json;
          target_per_period: number;
          color: string | null;
          icon: string | null;
          archived_at: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        } & AnyRecord;
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          cadence?: HabitCadence;
          cadence_config?: Json;
          target_per_period?: number;
          color?: string | null;
          icon?: string | null;
          archived_at?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        } & AnyRecord;
        Update: Partial<Database["public"]["Tables"]["habits"]["Insert"]> & AnyRecord;
        Relationships: [];
      };
      habit_logs: {
        Row: {
          id: string;
          user_id: string;
          habit_id: string;
          logged_on: string;
          count: number;
          note: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        } & AnyRecord;
        Insert: {
          id?: string;
          user_id?: string;
          habit_id: string;
          logged_on: string;
          count?: number;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        } & AnyRecord;
        Update: Partial<Database["public"]["Tables"]["habit_logs"]["Insert"]> & AnyRecord;
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          theme: "light" | "dark" | "auto";
          accent: string;
          sidebar_theme: string;
          density: "comfortable" | "compact";
          week_starts_on: number;
          work_hours_start: string;
          work_hours_end: string;
          pomodoro_focus_minutes: number;
          pomodoro_break_minutes: number;
          pomodoro_strict_mode: boolean;
          default_view: string;
          updated_at: string;
        } & AnyRecord;
        Insert: Partial<Database["public"]["Tables"]["user_settings"]["Row"]> & {
          user_id?: string;
        } & AnyRecord;
        Update: Partial<Database["public"]["Tables"]["user_settings"]["Row"]> & AnyRecord;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
