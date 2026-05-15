"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutList, KanbanSquare, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskList } from "@/components/tasks/task-list";
import { TaskRow } from "@/components/tasks/task-row";
import { useList, useUpdateList, useDeleteList } from "@/lib/lists/queries";
import { useListTasks } from "@/lib/tasks/queries";
import type { Task } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

const COLORS = [
  "#f25c2a", // pulse coral
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#ec4899", // pink
  "#6b7280", // slate
];

type ViewMode = "list" | "board";

export function ListClient({ listId }: { listId: string }) {
  const router = useRouter();
  const list = useList(listId);
  const tasks = useListTasks(listId);
  const update = useUpdateList();
  const remove = useDeleteList();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");

  if (list.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }
  if (list.error || !list.data) {
    return (
      <div className="pulse-pane p-6 text-sm text-muted-foreground">
        Project not found. It may have been deleted.
      </div>
    );
  }

  const data = list.data;
  const mode: ViewMode = data.view_mode === "board" ? "board" : "list";
  const color = data.color || "#6b7280";

  function setMode(next: ViewMode) {
    update.mutate({ id: listId, patch: { view_mode: next } });
  }

  function commitName() {
    const next = draft.trim();
    setRenaming(false);
    if (next && next !== data.name) {
      update.mutate({ id: listId, patch: { name: next } });
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <ColorDot
          color={color}
          onPick={(c) => update.mutate({ id: listId, patch: { color: c } })}
        />
        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitName();
              } else if (e.key === "Escape") {
                setRenaming(false);
              }
            }}
            className="border-0 bg-transparent font-display text-3xl font-semibold outline-none"
          />
        ) : (
          <h1
            onClick={() => {
              setDraft(data.name);
              setRenaming(true);
            }}
            className="cursor-text font-display text-3xl font-semibold tracking-tight"
          >
            {data.name}
          </h1>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant={mode === "list" ? "secondary" : "ghost"}
            onClick={() => setMode("list")}
            aria-label="Project list view"
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={mode === "board" ? "secondary" : "ghost"}
            onClick={() => setMode("board")}
            aria-label="Board view"
          >
            <KanbanSquare className="h-4 w-4" />
          </Button>
          <Menu projectName={data.name} onDelete={async () => {
            await remove.mutateAsync(listId);
            router.push("/today");
          }} />
        </div>
      </header>

      <QuickAdd defaultListId={listId} placeholder="Add task to this project" />

      {mode === "list" ? (
        <TaskList
          tasks={tasks.data ?? []}
          sortable
          emptyMessage={<span>No tasks yet. Add one above.</span>}
        />
      ) : (
        <BoardView tasks={tasks.data ?? []} />
      )}
    </div>
  );
}

function ColorDot({ color, onPick }: { color: string; onPick: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-4 w-4 rounded-full ring-2 ring-transparent hover:ring-border"
        style={{ backgroundColor: color }}
        aria-label="Change color"
      />
      {open && (
        <div
          className="pulse-pane absolute left-0 top-6 z-10 flex gap-1.5 p-2 shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              className="h-5 w-5 rounded-full ring-2 ring-transparent hover:ring-border"
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Menu({ onDelete, projectName }: { onDelete: () => void; projectName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} aria-label="More">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && (
        <div
          className="pulse-pane absolute right-0 top-9 z-10 w-40 p-1 shadow-lg"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            onClick={() => {
              setOpen(false);
              if (confirm(`Delete project "${projectName}"? Tasks are kept and moved to inbox.`)) onDelete();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Delete project
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Board view ---------------- */

const COLUMNS: Array<{ key: Task["status"]; label: string }> = [
  { key: "todo", label: "Todo" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

function BoardView({ tasks }: { tasks: Task[] }) {
  const byStatus = new Map<Task["status"], Task[]>();
  for (const col of COLUMNS) byStatus.set(col.key, []);
  for (const t of tasks) {
    const k = t.status as Task["status"];
    if (byStatus.has(k)) byStatus.get(k)!.push(t);
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const items = byStatus.get(col.key) ?? [];
        return (
          <div key={col.key} className="rounded-xl bg-muted/50 p-2">
            <div className="mb-2 flex items-center justify-between px-2 pt-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {col.label}
              </h3>
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <ul className="space-y-1">
              {items.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "pulse-pane",
                    "transition-shadow hover:shadow-md"
                  )}
                >
                  <TaskRow task={t} dense />
                </div>
              ))}
              {items.length === 0 && (
                <li className="px-2 py-3 text-xs text-muted-foreground">Empty</li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
