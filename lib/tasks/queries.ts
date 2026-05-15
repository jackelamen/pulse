"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  isOffline,
  queueTaskCreate,
  queueTaskUpdate,
  queueTaskDelete,
} from "@/lib/offline/task-queue";
import type { Task, TaskInsert, TaskEditableFields } from "./types";

const supabase = () => createClient();

function isTaskLike(value: unknown): value is Task {
  return !!value && typeof value === "object" && "id" in value;
}

/* ------------------------------------------------------------------ */
/* Query keys                                                          */
/* ------------------------------------------------------------------ */

export const taskKeys = {
  all: ["tasks"] as const,
  today: () => [...taskKeys.all, "today"] as const,
  leftovers: () => [...taskKeys.all, "leftovers"] as const,
  completedToday: () => [...taskKeys.all, "completedToday"] as const,
  completedRecent: () => [...taskKeys.all, "completedRecent"] as const,
  inbox: () => [...taskKeys.all, "inbox"] as const,
  anytime: () => [...taskKeys.all, "anytime"] as const,
  someday: () => [...taskKeys.all, "someday"] as const,
  list: (listId: string) => [...taskKeys.all, "list", listId] as const,
};

/* ------------------------------------------------------------------ */
/* Day boundaries (in user's local TZ)                                 */
/* ------------------------------------------------------------------ */

function startOfLocalDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfLocalDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

/**
 * Today: tasks due or scheduled today.
 * Leftovers: incomplete tasks whose due_at OR start_at is before today's start.
 * Inbox: tasks with list_id null and no scheduled date.
 *
 * All reads are scoped by RLS to the current user.
 */
export function useTodayTasks() {
  return useQuery({
    queryKey: taskKeys.today(),
    queryFn: async () => {
      const now = new Date();
      const startISO = startOfLocalDay(now).toISOString();
      const endISO = endOfLocalDay(now).toISOString();
      const { data, error } = await supabase()
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .is("parent_task_id", null)
        .is("completed_at", null)
        .neq("status", "cancelled")
        .or(
          `and(due_at.gte.${startISO},due_at.lte.${endISO}),` +
            `and(start_at.gte.${startISO},start_at.lte.${endISO})`
        )
        .order("start_at", { ascending: true, nullsFirst: false })
        .order("priority", { ascending: false })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

export function useCompletedTodayTasks() {
  return useQuery({
    queryKey: taskKeys.completedToday(),
    queryFn: async () => {
      const now = new Date();
      const startISO = startOfLocalDay(now).toISOString();
      const endISO = endOfLocalDay(now).toISOString();
      const { data, error } = await supabase()
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .is("parent_task_id", null)
        .gte("completed_at", startISO)
        .lte("completed_at", endISO)
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

export function useRecentCompletedTasks() {
  return useQuery({
    queryKey: taskKeys.completedRecent(),
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .is("parent_task_id", null)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

export function useLeftoverTasks() {
  return useQuery({
    queryKey: taskKeys.leftovers(),
    queryFn: async () => {
      const startISO = startOfLocalDay(new Date()).toISOString();
      const { data, error } = await supabase()
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .is("parent_task_id", null)
        .is("completed_at", null)
        .or(`due_at.lt.${startISO},start_at.lt.${startISO}`)
        .order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

export function useInboxTasks() {
  return useQuery({
    queryKey: taskKeys.inbox(),
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .is("parent_task_id", null)
        .is("list_id", null)
        .is("start_at", null)
        .is("due_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

export function useAnytimeTasks() {
  return useQuery({
    queryKey: taskKeys.anytime(),
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .is("parent_task_id", null)
        .is("completed_at", null)
        .neq("status", "cancelled")
        .is("start_at", null)
        .is("due_at", null)
        .not("tags", "cs", "{someday}")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

export function useSomedayTasks() {
  return useQuery({
    queryKey: taskKeys.someday(),
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .is("parent_task_id", null)
        .is("completed_at", null)
        .neq("status", "cancelled")
        .contains("tags", ["someday"])
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

export function useListTasks(listId: string | undefined) {
  return useQuery({
    queryKey: listId ? taskKeys.list(listId) : ["tasks", "noop"],
    enabled: !!listId,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("tasks")
        .select("*")
        .eq("list_id", listId!)
        .is("deleted_at", null)
        .is("parent_task_id", null)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

export function useSubtasks(parentId: string | undefined) {
  return useQuery({
    queryKey: ["tasks", "subtasks", parentId ?? "noop"],
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("tasks")
        .select("*")
        .eq("parent_task_id", parentId!)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TaskInsert) => {
      if (isOffline()) {
        return queueTaskCreate(input);
      }
      // user_id defaults to auth.uid() at the DB level; RLS enforces.
      const { data, error } = await supabase()
        .from("tasks")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useToggleComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: Task) => {
      const completing = !task.completed_at;
      const patch = completing
        ? { completed_at: new Date().toISOString(), status: "done" as const }
        : { completed_at: null, status: "todo" as const };

      if (isOffline()) {
        // Optimistic cache already updated in onMutate; queue the server write.
        queueTaskUpdate(task.id, patch);
        return { ...task, ...patch } as Task;
      }

      const { data, error } = await supabase()
        .from("tasks")
        .update(patch)
        .eq("id", task.id)
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },

    // Optimistic flip — the strike-through animation should land instantly.
    onMutate: async (task) => {
      await qc.cancelQueries({ queryKey: taskKeys.all });
      const previous = qc.getQueriesData<unknown>({ queryKey: taskKeys.all });
      const completed_at = task.completed_at ? null : new Date().toISOString();
      const status = task.completed_at ? ("todo" as const) : ("done" as const);

      qc.setQueriesData<unknown>({ queryKey: taskKeys.all }, (old: unknown) => {
        if (Array.isArray(old)) {
          return old.map((t) =>
            isTaskLike(t) && t.id === task.id ? { ...t, completed_at, status } : t
          );
        }
        if (isTaskLike(old) && old.id === task.id) {
          return { ...old, completed_at, status };
        }
        return old;
      });
      return { previous };
    },
    onError: (_err, _task, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TaskEditableFields }) => {
      if (isOffline()) {
        queueTaskUpdate(id, patch);
        // Synthesize the patched row so callers can keep working optimistically.
        const cached = qc.getQueriesData<unknown>({ queryKey: taskKeys.all });
        for (const [, list] of cached) {
          if (!Array.isArray(list)) continue;
          const found = list.find((t) => isTaskLike(t) && t.id === id);
          if (found) return { ...found, ...patch } as Task;
        }
        return { id, ...patch } as unknown as Task;
      }
      const { data, error } = await supabase()
        .from("tasks")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isOffline()) {
        queueTaskDelete(id);
        return id;
      }
      // Soft-delete so undo and logbook are possible.
      const { error } = await supabase()
        .from("tasks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

/**
 * Window query — everything that could contribute to a date range, including
 * templates (so the recurrence expander can fan them out client-side).
 *
 * Returns: tasks with start_at OR due_at in window, plus all recurrence
 * templates (recurrence_rule not null), plus all materialized exceptions in
 * window. Caller passes through `expandRecurrences` for the actual instances.
 */
export function useTasksInWindow(start: Date, end: Date) {
  const startISO = start.toISOString();
  const endISO = end.toISOString();
  return useQuery({
    queryKey: [...taskKeys.all, "window", startISO, endISO],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .is("parent_task_id", null)
        .or(
          `recurrence_rule.not.is.null,` +
            `and(start_at.gte.${startISO},start_at.lte.${endISO}),` +
            `and(due_at.gte.${startISO},due_at.lte.${endISO})`
        );
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

export function useMaterializeException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      templateId,
      occursOn,
      patch,
    }: {
      templateId: string;
      occursOn: string; // ISO of the instance's anchor date
      patch: Partial<Task>;
    }) => {
      // Fetch the template to copy invariant fields, then insert an exception.
      const { data: tpl, error: tplErr } = await supabase()
        .from("tasks")
        .select("*")
        .eq("id", templateId)
        .single();
      if (tplErr) throw tplErr;

      const template = tpl as Task;
      const date = new Date(occursOn);
      const start_at = template.start_at
        ? withDate(new Date(template.start_at), date).toISOString()
        : null;
      const due_at = template.due_at ? withDate(new Date(template.due_at), date).toISOString() : null;

      const insert: TaskInsert = {
        title: template.title,
        notes: template.notes,
        priority: template.priority,
        list_id: template.list_id,
        tags: template.tags ?? [],
        all_day: template.all_day,
        duration_minutes: template.duration_minutes,
        start_at,
        due_at,
        recurrence_parent_id: templateId,
        ...patch,
      };
      const { data, error } = await supabase().from("tasks").insert(insert).select().single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

function withDate(time: Date, day: Date) {
  const out = new Date(day);
  out.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return out;
}

export function useReorderTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, sort_order }: { id: string; sort_order: number }) => {
      const { data, error } = await supabase()
        .from("tasks")
        .update({ sort_order })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

/* ------------------------------------------------------------------ */
/* Bulk leftovers actions (per spec section 7.2)                       */
/* ------------------------------------------------------------------ */

export function useRescheduleLeftovers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, target }: { ids: string[]; target: "today" | "tomorrow" | "inbox" }) => {
      let patch: TaskEditableFields = {};
      if (target === "today") {
        const t = startOfLocalDay(new Date());
        patch = { due_at: t.toISOString() };
      } else if (target === "tomorrow") {
        const t = startOfLocalDay(new Date());
        t.setDate(t.getDate() + 1);
        patch = { due_at: t.toISOString() };
      } else {
        patch = { due_at: null, start_at: null, list_id: null };
      }

      const { error } = await supabase()
        .from("tasks")
        .update(patch)
        .in("id", ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
