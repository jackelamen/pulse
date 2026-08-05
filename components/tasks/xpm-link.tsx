"use client";

import { useState } from "react";
import { Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useXpmWorkspaces,
  useXpmSpaces,
  useXpmProjects,
  usePulseXpmLink,
  useXpmProjectLabel,
  useLinkTaskToXpm,
  useUnlinkTaskFromXpm,
} from "@/lib/xpm/queries";

/**
 * Attribute a Pulse task to an xPM Workspace -> Space -> Project. Only the
 * project actually needs to be picked (a project already carries its own
 * space/workspace); Space is just a filter to narrow the project list.
 *
 * Saving triggers `promote_pulse_task_to_xpm` server-side (migration 0012),
 * which creates a real xpm_tasks row the first time, or moves it if the
 * project is changed later. Unlinking only removes Pulse's pointer -- the
 * xPM task itself is never deleted or archived from here.
 */
export function XpmLink({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  const link = usePulseXpmLink(taskId);
  const linkTask = useLinkTaskToXpm();
  const unlink = useUnlinkTaskFromXpm();
  const label = useXpmProjectLabel(link.data?.xpm_project_id);

  const [editing, setEditing] = useState(false);

  if (link.isLoading) {
    return <p className="text-xs text-muted-foreground">Loading…</p>;
  }

  if (link.data?.xpm_project_id && !editing) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs">
          <Link2 className="h-3 w-3 text-primary" />
          {label.data ? `${label.data.workspaceName} › ${label.data.projectName}` : "Linked"}
        </span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Change
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={unlink.isPending}
            onClick={() => unlink.mutate(taskId)}
            aria-label="Unlink from xPM"
            title="Unlink (the xPM task itself is kept)"
          >
            <Unlink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ProjectPicker
      onCancel={link.data?.xpm_project_id ? () => setEditing(false) : undefined}
      onPick={(workspaceId, projectId) => {
        linkTask.mutate(
          { pulseTaskId: taskId, pulseTaskTitle: taskTitle, workspaceId, projectId },
          { onSuccess: () => setEditing(false) }
        );
      }}
      saving={linkTask.isPending}
    />
  );
}

function ProjectPicker({
  onPick,
  onCancel,
  saving,
}: {
  onPick: (workspaceId: string, projectId: string) => void;
  onCancel?: () => void;
  saving: boolean;
}) {
  const workspaces = useXpmWorkspaces();
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [spaceId, setSpaceId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");

  const spaces = useXpmSpaces(workspaceId || undefined);
  const projects = useXpmProjects(workspaceId || undefined, spaceId || null);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={workspaceId}
          onChange={(e) => {
            setWorkspaceId(e.target.value);
            setSpaceId("");
            setProjectId("");
          }}
          className="rounded-md border border-border bg-card px-2 py-1 text-xs"
        >
          <option value="">Workspace…</option>
          {(workspaces.data ?? []).map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>

        <select
          value={spaceId}
          disabled={!workspaceId || (spaces.data ?? []).length === 0}
          onChange={(e) => {
            setSpaceId(e.target.value);
            setProjectId("");
          }}
          className="rounded-md border border-border bg-card px-2 py-1 text-xs disabled:opacity-50"
        >
          <option value="">All spaces</option>
          {(spaces.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={projectId}
          disabled={!workspaceId}
          onChange={(e) => setProjectId(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-1 text-xs disabled:opacity-50"
        >
          <option value="">Project…</option>
          {(projects.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={projectId ? "default" : "ghost"}
          disabled={!workspaceId || !projectId || saving}
          onClick={() => onPick(workspaceId, projectId)}
        >
          {saving ? "Saving…" : "Attribute"}
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
