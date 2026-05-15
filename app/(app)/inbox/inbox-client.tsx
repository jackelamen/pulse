"use client";

import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskList } from "@/components/tasks/task-list";
import { useInboxTasks } from "@/lib/tasks/queries";

export function InboxClient() {
  const { data, isLoading } = useInboxTasks();

  return (
    <div className="space-y-5">
      <QuickAdd
        placeholder="What's on your mind?"
        defaultListId={null}
      />

      {isLoading ? (
        <div className="px-3 py-6 text-sm text-muted-foreground">Loading...</div>
      ) : (
        <TaskList
          tasks={data ?? []}
          sortable
          emptyMessage={
            <span>
              Inbox is empty. Type above or press <span className="pulse-kbd">N</span> from anywhere.
            </span>
          }
        />
      )}
    </div>
  );
}
