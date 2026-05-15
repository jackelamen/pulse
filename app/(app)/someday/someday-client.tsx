"use client";

import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskList } from "@/components/tasks/task-list";
import { useSomedayTasks } from "@/lib/tasks/queries";

export function SomedayClient() {
  const { data, isLoading } = useSomedayTasks();

  return (
    <div className="space-y-5">
      <QuickAdd
        placeholder="Add a maybe-later task"
        defaultListId={null}
        defaultTags={["someday"]}
      />

      <div className="rounded-2xl border border-border bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
        Tasks appear here when they have the{" "}
        <span className="font-medium text-foreground">#someday</span> tag.
      </div>

      {isLoading ? (
        <div className="px-3 py-6 text-sm text-muted-foreground">Loading...</div>
      ) : (
        <TaskList
          tasks={data ?? []}
          sortable
          emptyMessage={
            <span>
              Nothing parked for later. Add something above, or add{" "}
              <span className="pulse-kbd">#someday</span> to an existing task.
            </span>
          }
        />
      )}
    </div>
  );
}
