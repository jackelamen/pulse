"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { XpmWorkspace, XpmSpace, XpmProject, PulseXpmTaskLink } from "./types";

const supabase = () => createClient();

export const xpmKeys = {
  workspaces: ["xpm", "workspaces"] as const,
  spaces: (workspaceId: string | undefined) => ["xpm", "spaces", workspaceId ?? "none"] as const,
  projects: (workspaceId: string | undefined, spaceId: string | undefined | null) =>
    ["xpm", "projects", workspaceId ?? "none", spaceId ?? "none"] as const,
  link: (pulseTaskId: string | undefined) => ["xpm", "link", pulseTaskId ?? "none"] as const,
};

/** Workspaces the current user belongs to (RLS-scoped via workspace_members). */
export function useXpmWorkspaces() {
  return useQuery({
    queryKey: xpmKeys.workspaces,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("workspaces")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as XpmWorkspace[];
    },
  });
}

/** Spaces within a workspace, for filtering the project picker. */
export function useXpmSpaces(workspaceId: string | undefined) {
  return useQuery({
    queryKey: xpmKeys.spaces(workspaceId),
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("spaces")
        .select("id, workspace_id, name")
        .eq("workspace_id", workspaceId!)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as XpmSpace[];
    },
  });
}

/**
 * Projects within a workspace, optionally narrowed to one space. Archived
 * projects are excluded -- attributing a task to a dead project isn't useful.
 */
export function useXpmProjects(workspaceId: string | undefined, spaceId: string | undefined | null) {
  return useQuery({
    queryKey: xpmKeys.projects(workspaceId, spaceId),
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = supabase()
        .from("projects")
        .select("id, workspace_id, space_id, name, status, archived_at")
        .eq("workspace_id", workspaceId!)
        .is("archived_at", null);
      if (spaceId) q = q.eq("space_id", spaceId);
      const { data, error } = await q.order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as XpmProject[];
    },
  });
}

/**
 * Display label for an already-linked project: its own name plus its
 * workspace's name, resolved directly by id (not filtered by archived_at,
 * so a linked-then-archived project still renders a sensible label instead
 * of silently disappearing from view).
 */
export function useXpmProjectLabel(projectId: string | undefined | null) {
  return useQuery({
    queryKey: ["xpm", "project-label", projectId ?? "none"],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("projects")
        .select("id, name, workspace_id, workspaces:workspace_id (name)")
        .eq("id", projectId!)
        .single();
      if (error) throw error;
      const row = data as unknown as {
        name: string;
        workspaces: { name: string } | { name: string }[] | null;
      };
      const workspaceName = Array.isArray(row.workspaces)
        ? row.workspaces[0]?.name
        : row.workspaces?.name;
      return { projectName: row.name, workspaceName: workspaceName ?? "Workspace" };
    },
  });
}

/** The current xPM attribution (if any) for a Pulse task. */
export function usePulseXpmLink(pulseTaskId: string | undefined) {
  return useQuery({
    queryKey: xpmKeys.link(pulseTaskId),
    enabled: !!pulseTaskId,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("pulse_xpm_task_links")
        .select("*")
        .eq("pulse_task_id", pulseTaskId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as PulseXpmTaskLink | null;
    },
  });
}

/**
 * Attribute (or re-attribute) a Pulse task to an xPM workspace/project.
 * Only inserts/updates the link row -- the `promote_pulse_task_to_xpm`
 * Postgres trigger (migration 0012) does the actual work: creating the
 * xpm_tasks row the first time, or moving it if the project changes on an
 * already-promoted task.
 */
export function useLinkTaskToXpm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pulseTaskId,
      pulseTaskTitle,
      workspaceId,
      projectId,
    }: {
      pulseTaskId: string;
      pulseTaskTitle: string;
      workspaceId: string;
      projectId: string;
    }) => {
      const {
        data: { user },
      } = await supabase().auth.getUser();
      if (!user) throw new Error("Not signed in.");

      const { data, error } = await supabase()
        .from("pulse_xpm_task_links")
        .upsert(
          {
            user_id: user.id,
            pulse_task_id: pulseTaskId,
            pulse_task_title: pulseTaskTitle,
            xpm_workspace_id: workspaceId,
            xpm_project_id: projectId,
          },
          { onConflict: "user_id,pulse_task_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data as PulseXpmTaskLink;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: xpmKeys.link(data.pulse_task_id) });
    },
  });
}

/**
 * Remove the attribution. By design this does NOT touch the xpm_tasks row --
 * once promoted, it stands on its own as a real xPM task; unlinking only
 * severs Pulse's pointer to it so an accidental unlink can never delete or
 * archive real project data.
 */
export function useUnlinkTaskFromXpm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pulseTaskId: string) => {
      const { error } = await supabase()
        .from("pulse_xpm_task_links")
        .delete()
        .eq("pulse_task_id", pulseTaskId);
      if (error) throw error;
      return pulseTaskId;
    },
    onSuccess: (pulseTaskId) => {
      qc.invalidateQueries({ queryKey: xpmKeys.link(pulseTaskId) });
    },
  });
}
