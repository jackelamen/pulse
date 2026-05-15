"use client";

import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskList } from "@/components/tasks/task-list";
import { useAnytimeTasks } from "@/lib/tasks/queries";

export function AnytimeClient() {
  const { data, isLoading } = useAnytimeTasks();

  return (
    <div className="space-y-5">
      <QuickAdd placeholder="Add something you can do anytime" defaultListId={null} />

      <div className="rounded-2xl border border-border bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
        Tasks appear here when both <span className="font-medium text-foreground">Starts</span> and{" "}
        <span className="font-medium text-foreground">Due</span> are empty.
      </div>

      {isLoading ? (
        <div className="px-3 py-6 text-sm text-muted-foreground">Loading...</div>
      ) : (
        <TaskList
          tasks={data ?? []}
          sortable
          emptyMessage={
            <span>
              No anytime tasks yet. Clear the Starts and Due fields on a task, or add one above.
            </span>
          }
        />
      )}
    </div>
  );
}
