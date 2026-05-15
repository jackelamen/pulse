"use client";

import { useMemo, useState } from "react";
import { Tags } from "lucide-react";
import { TaskRow } from "./task-row";
import { tagColor } from "@/lib/lists/tag-colors";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/tasks/types";

export function TaskList({
  tasks,
  emptyMessage,
  dense = false,
  sortable = false,
}: {
  tasks: Task[];
  emptyMessage?: React.ReactNode;
  dense?: boolean;
  sortable?: boolean;
}) {
  const [sortMode, setSortMode] = useState<"default" | "tag">("default");
  const tagGroups = useMemo(() => groupByPrimaryTag(tasks), [tasks]);

  if (tasks.length === 0 && emptyMessage) {
    return <div className="px-3 py-6 text-sm text-muted-foreground">{emptyMessage}</div>;
  }
  if (tasks.length === 0) return null;

  const controls = sortable ? (
    <div className="mb-3 flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => setSortMode("default")}
        className={cn(
          "rounded-md px-2 py-1 text-xs font-medium transition-colors",
          sortMode === "default"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/50"
        )}
      >
        Order
      </button>
      <button
        type="button"
        onClick={() => setSortMode("tag")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
          sortMode === "tag"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/50"
        )}
      >
        <Tags className="h-3.5 w-3.5" />
        Tags
      </button>
    </div>
  ) : null;

  if (sortMode === "tag") {
    return (
      <div>
        {controls}
        <div className="space-y-5">
          {tagGroups.map((group) => (
            <section key={group.key}>
              <div className="mb-2 flex items-center gap-2 px-1">
                {group.tag ? (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: tagColor(group.tag) }}
                  />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                )}
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h3>
                <span className="text-xs text-muted-foreground">{group.tasks.length}</span>
              </div>
              <ul className="space-y-1.5">
                {group.tasks.map((t) => (
                  <TaskRow key={t.id} task={t} dense={dense} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {controls}
      <ul className="space-y-1.5">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} dense={dense} />
        ))}
      </ul>
    </div>
  );
}

function groupByPrimaryTag(tasks: Task[]) {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const tag = [...(task.tags ?? [])].sort((a, b) => a.localeCompare(b))[0] ?? "";
    groups.set(tag, [...(groups.get(tag) ?? []), task]);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b);
    })
    .map(([tag, groupTasks]) => ({
      key: tag || "__untagged",
      tag: tag || null,
      label: tag ? `#${tag}` : "No tag",
      tasks: groupTasks,
    }));
}
