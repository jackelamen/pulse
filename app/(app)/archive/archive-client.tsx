"use client";

import { useMemo, useState } from "react";
import {
  ArchiveIcon,
  ArchiveRestore,
  CheckCircle2,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLists } from "@/lib/lists/queries";
import {
  useArchivedTasks,
  useRecentCompletedTasks,
  useArchiveTask,
  useBulkArchive,
  useRestoreTask,
  usePermanentDelete,
} from "@/lib/tasks/queries";
import { useUi } from "@/lib/ui/store";
import { dayLabel } from "@/lib/date";
import type { Task } from "@/lib/tasks/types";

export function ArchiveClient() {
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const archived = useArchivedTasks(search);
  const completed = useRecentCompletedTasks();
  const lists = useLists();

  const archiveOne = useArchiveTask();
  const bulkArchive = useBulkArchive();
  const restore = useRestoreTask();
  const purge = usePermanentDelete();
  const openTask = useUi((s) => s.openTask);

  const projectName = useMemo(
    () => new Map((lists.data ?? []).map((l) => [l.id, l.name])),
    [lists.data]
  );

  // Tags present across the archived set, for the filter chips.
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const t of archived.data ?? []) (t.tags ?? []).forEach((tag) => set.add(tag));
    return Array.from(set).sort();
  }, [archived.data]);

  const visibleArchived = useMemo(() => {
    const rows = archived.data ?? [];
    if (!tagFilter) return rows;
    return rows.filter((t) => (t.tags ?? []).includes(tagFilter));
  }, [archived.data, tagFilter]);

  const completedNotArchived = completed.data ?? [];

  return (
    <div className="space-y-6">
      {/* Completed tasks ready to archive */}
      {completedNotArchived.length > 0 && (
        <section className="pulse-pane p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <h2 className="pulse-section-label">
                Completed ({completedNotArchived.length})
              </h2>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={bulkArchive.isPending}
              onClick={() => {
                const ok = window.confirm(
                  `Archive all ${completedNotArchived.length} completed task${
                    completedNotArchived.length === 1 ? "" : "s"
                  }? They move out of the logbook into the archive.`
                );
                if (!ok) return;
                bulkArchive.mutate(completedNotArchived.map((t) => t.id));
              }}
            >
              <ArchiveIcon className="mr-1.5 h-3.5 w-3.5" />
              Archive all
            </Button>
          </div>
          <ul className="space-y-2">
            {completedNotArchived.slice(0, 50).map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm"
              >
                <button
                  type="button"
                  onClick={() => openTask(task.id)}
                  className="min-w-0 flex-1 truncate text-left hover:underline"
                >
                  {task.title}
                </button>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {task.completed_at
                    ? dayLabel(new Date(task.completed_at), new Date())
                    : ""}
                </span>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  disabled={archiveOne.isPending}
                  onClick={() => archiveOne.mutate(task.id)}
                  aria-label="Archive task"
                  title="Archive task"
                >
                  <ArchiveIcon className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Search + tag filter */}
      <section className="pulse-pane p-4">
        <div className="mb-3 flex items-center gap-2">
          <ArchiveIcon className="h-4 w-4 text-primary" />
          <h2 className="pulse-section-label">Archived</h2>
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search archived tasks..."
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>

        {allTags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            <FilterChip
              label="All"
              active={tagFilter === null}
              onClick={() => setTagFilter(null)}
            />
            {allTags.map((tag) => (
              <FilterChip
                key={tag}
                label={`#${tag}`}
                active={tagFilter === tag}
                onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              />
            ))}
          </div>
        )}

        {archived.isLoading ? (
          <p className="px-1 py-6 text-sm text-muted-foreground">Loading...</p>
        ) : visibleArchived.length === 0 ? (
          <p className="px-1 py-6 text-sm text-muted-foreground">
            {search || tagFilter
              ? "No archived tasks match."
              : "Nothing archived yet. Archived tasks will collect here."}
          </p>
        ) : (
          <ul className="space-y-2">
            {visibleArchived.map((task) => (
              <ArchivedRow
                key={task.id}
                task={task}
                projectName={
                  task.list_id ? projectName.get(task.list_id) ?? null : null
                }
                onOpen={() => openTask(task.id)}
                onRestore={() => restore.mutate(task.id)}
                onPurge={() => {
                  const ok = window.confirm(
                    `Permanently delete "${task.title}"? This cannot be undone.`
                  );
                  if (ok) purge.mutate(task.id);
                }}
                busy={restore.isPending || purge.isPending}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ArchivedRow({
  task,
  projectName,
  onOpen,
  onRestore,
  onPurge,
  busy,
}: {
  task: Task;
  projectName: string | null;
  onOpen: () => void;
  onRestore: () => void;
  onPurge: () => void;
  busy: boolean;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          className="block max-w-full truncate text-left font-medium hover:underline"
        >
          {task.title}
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {projectName && <span className="truncate">{projectName}</span>}
          {(task.tags ?? []).map((tag) => (
            <span key={tag} className="truncate">
              #{tag}
            </span>
          ))}
          {task.archived_at && (
            <span>Archived {dayLabel(new Date(task.archived_at), new Date())}</span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        disabled={busy}
        onClick={onRestore}
        aria-label="Restore task"
        title="Restore to active"
      >
        <ArchiveRestore className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        disabled={busy}
        onClick={onPurge}
        aria-label="Permanently delete task"
        title="Delete permanently"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-md border px-2 py-1 text-xs font-medium transition-colors " +
        (active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted/50")
      }
    >
      {label}
    </button>
  );
}
