/**
 * Minimal shapes for the xPM-adjacent tables Pulse reads/writes when
 * attributing a task to a Workspace/Space/Project. These tables live in
 * xPM's part of the shared schema (see supabase/migrations/0012_*), so they
 * aren't declared in Pulse's own hand-written Database type -- just enough
 * fields to drive the picker and the link row.
 */

export type XpmWorkspace = {
  id: string;
  name: string;
};

export type XpmSpace = {
  id: string;
  workspace_id: string;
  name: string;
};

export type XpmProject = {
  id: string;
  workspace_id: string;
  space_id: string | null;
  name: string;
  status: string;
  archived_at: string | null;
};

export type PulseXpmSyncStatus = "linked" | "needs_review" | "ignored" | "promoted";

export type PulseXpmTaskLink = {
  id: string;
  user_id: string;
  pulse_task_id: string;
  pulse_task_title: string | null;
  xpm_workspace_id: string | null;
  xpm_project_id: string | null;
  xpm_task_id: string | null;
  sync_status: PulseXpmSyncStatus;
  created_at: string;
  updated_at: string;
};
