"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { QuickAdd } from "@/components/tasks/quick-add";
import { Flag } from "lucide-react";
import type { Task } from "@/lib/tasks/types";

export function UnscheduledRail() {
  const { data } = useQuery({
    queryKey: ["tasks", "unscheduled"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .is("completed_at", null)
        .is("start_at", null)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-card">
      <div className="border-b border-border px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Unscheduled
        </h2>
      </div>
      <div className="p-2">
        <QuickAdd placeholder="Add task" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {(data ?? []).length === 0 ? (
          <div className="px-3 py-6 text-xs text-muted-foreground">
            No unscheduled tasks. Drag finished work back here to clear it.
          </div>
        ) : (
          <ul className="space-y-1 px-1">
            {(data ?? []).map((t) => (
              <DraggableTaskCard key={t.id} task={t} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function DraggableTaskCard({ task }: { task: Task }) {
  function handleDragStart(e: React.DragEvent) {
    const payload = JSON.stringify({
      taskId: task.id,
      virtual: false,
      duration: task.duration_minutes ?? 30,
      kind: "schedule",
    });
    e.dataTransfer.setData("application/x-pulse-event", payload);
    e.dataTransfer.effectAllowed = "move";
  }
  return (
    <li
      draggable
      onDragStart={handleDragStart}
      className="cursor-grab rounded-md border border-border bg-card/80 px-2 py-1.5 text-xs shadow-sm transition-colors hover:bg-muted/40 active:cursor-grabbing"
    >
      <div className="flex items-start gap-1.5">
        {task.priority > 0 && (
          <Flag
            className={`mt-0.5 h-3 w-3 shrink-0 ${
              task.priority === 3 ? "text-rose-500" : task.priority === 2 ? "text-amber-500" : "text-sky-500"
            }`}
          />
        )}
        <span className="line-clamp-2 leading-snug">{task.title}</span>
      </div>
      {task.duration_minutes && (
        <div className="mt-0.5 text-[10px] text-muted-foreground">{task.duration_minutes}m</div>
      )}
    </li>
  );
}
