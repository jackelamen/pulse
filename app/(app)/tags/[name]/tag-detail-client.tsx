"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { TaskList } from "@/components/tasks/task-list";
import type { Task } from "@/lib/tasks/types";

export function TagDetailClient({ tag }: { tag: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["tasks", "tag", tag],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .contains("tags", [tag])
        .order("completed_at", { ascending: true, nullsFirst: true })
        .order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <TaskList
      tasks={data ?? []}
      emptyMessage={<span>No tasks with this tag yet.</span>}
    />
  );
}
