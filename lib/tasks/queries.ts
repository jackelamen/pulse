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
/* Google Calendar sync marking (one-way, Pulse -> Google)             */
/*                                                                      */
/* These helpers only set the google_sync_state column so the          */
/* server-side push-to-google Edge Function can pick the row up. They   */
/* never call Google directly — the save stays fast and offline-safe.  */
/*                                                                      */
/* Recurring tasks ARE synced (v2): a template row is pushed as a       */
/* single Google recurring event (the Edge Function translates the      */
/* RRULE). Materialized exception rows (recurrence_parent_id set) are   */
/* NOT synced on their own — the series already covers that date.       */
/* Over-marking delete_pending is harmless: the Edge Function skips     */
/* delete_pending rows that have no google_event_id.                    */
/* ------------------------------------------------------------------ */

type SyncableWrite = {
  start_at?: string | null;
  due_at?: string | null;
  recurrence_rule?: string | null;
  recurrence_parent_id?: string | null;
};

/**
 * Sync state for a create/update that may carry scheduling fields.
 *
 * A task is syncable when it is "scheduled": it has a start_at, OR it is a
 * recurring template (recurrence_rule set) anchored by start_at/due_at.
 * Exception instances (recurrence_parent_id set) are never synced directly.
 */
function syncStateForWrite(write: SyncableWrite): "pending" | "delete_pending" | undefined {
  // A materialized exception instance is covered by its series — don't sync it.
  if (write.recurrence_parent_id) return undefined;

  const touchesSchedule =
    "start_at" in write || "due_at" in write || "recurrence_rule" in write;
  if (!touchesSchedule) return undefined;

  const isRecurring = !!write.recurrence_rule;
  // Recurring templates anchor on start_at or due_at; one-offs need start_at.
  const isScheduled = isRecurring
    ? !!(write.start_at || write.due_at)
    : !!write.start_at;

  return isScheduled ? "pending" : "delete_pending";
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
  archived: (search: string) => [...taskKeys.all, "archived", search] as const,
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
        .is("archived_at", null)
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
        .is("archived_at", null)
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
        .is("archived_at", null)
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
        .is("archived_at", null)
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
        .is("archived_at", null)
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
        .is("archived_at", null)
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
        .is("archived_at", null)
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
        .is("archived_at", null)
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
        .is("archived_at", null)
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
      const syncState = syncStateForWrite(input as SyncableWrite);
      const insert = syncState ? { ...input, google_sync_state: syncState } : input;
      const { data, error } = await supabase()
        .from("tasks")
        .insert(insert)
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

      // Completing a synced task removes it from Google; un-completing a
      // scheduled, non-recurring task re-pushes it.
      const syncPatch: { google_sync_state?: "pending" | "delete_pending" } = {};
      if (completing) {
        if (task.google_event_id) syncPatch.google_sync_state = "delete_pending";
      } else if (task.start_at && !task.recurrence_rule) {
        syncPatch.google_sync_state = "pending";
      }
      Object.assign(patch, syncPatch);

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
      const syncState = syncStateForWrite(patch as SyncableWrite);
      const update = syncState ? { ...patch, google_sync_state: syncState } : patch;
      const { data, error } = await supabase()
        .from("tasks")
        .update(update)
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
      // Soft-delete so undo and logbook are possible. Mark for Google removal;
      // the Edge Function skips rows that never had a google_event_id.
      const { error } = await supabase()
        .from("tasks")
        .update({ deleted_at: new Date().toISOString(), google_sync_state: "delete_pending" })
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
        .is("archived_at", null)
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

/**
 * Push leftovers to today/tomorrow/inbox.
 *
 * Takes full Task objects (not just ids) because "today"/"tomorrow" need to
 * know each task's OWN start_at/due_at to do the right thing:
 *  - Only the date moves forward; the original time-of-day is preserved.
 *    (Previously this collapsed every pushed task to a flat midnight
 *    due_at, which is why pushed tasks showed up at 12:00 AM.)
 *  - Only the field(s) that were actually in the past get touched. A task
 *    with a past start_at (not due_at) previously had ONLY due_at patched,
 *    leaving its stale start_at untouched -- which both kept it looking
 *    wrong AND meant it never stopped matching the leftovers query (which
 *    checks start_at OR due_at), so "push to today" silently appeared to
 *    do nothing for scheduled tasks.
 */
export function useRescheduleLeftovers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tasks, target }: { tasks: Task[]; target: "today" | "tomorrow" | "inbox" }) => {
      if (tasks.length === 0) return [];

      if (target === "inbox") {
        const ids = tasks.map((t) => t.id);
        const { error } = await supabase()
          .from("tasks")
          .update({ due_at: null, start_at: null, list_id: null })
          .in("id", ids);
        if (error) throw error;
        return ids;
      }

      const targetDay = startOfLocalDay(new Date());
      if (target === "tomorrow") targetDay.setDate(targetDay.getDate() + 1);

      const writes = tasks.map((task) => {
        const patch: TaskEditableFields = {};
        if (task.start_at) patch.start_at = withDate(new Date(task.start_at), targetDay).toISOString();
        if (task.due_at) patch.due_at = withDate(new Date(task.due_at), targetDay).toISOString();
        return supabase().from("tasks").update(patch).eq("id", task.id);
      });
      const results = await Promise.all(writes);
      const failed = results.find((r) => r.error)?.error;
      if (failed) throw failed;
      return tasks.map((t) => t.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Archive                                                             */
/*                                                                      */
/* archived_at marks a task as "put away". Archived tasks are excluded  */
/* from all active scopes and the logbook; they live only in the       */
/* Archive view. Restoring clears archived_at. Permanent delete is a    */
/* hard delete (no recovery), distinct from the soft delete used by     */
/* useDeleteTask.                                                        */
/* ------------------------------------------------------------------ */

/**
 * Archived tasks, newest-archived first. Optional case-insensitive search
 * over the title. Tag/project filtering is done client-side in the view so
 * this query stays simple and cache-friendly.
 */
export function useArchivedTasks(search = "") {
  const term = search.trim();
  return useQuery({
    queryKey: taskKeys.archived(term.toLowerCase()),
    queryFn: async () => {
      let q = supabase()
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .is("parent_task_id", null)
        .not("archived_at", "is", null);
      if (term) {
        const safe = term.replace(/[%,]/g, "");
        q = q.ilike("title", `%${safe}%`);
      }
      const { data, error } = await q
        .order("archived_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

/** Archive a single task (set archived_at = now). */
export function useArchiveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase()
        .from("tasks")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

/** Archive many tasks at once. */
export function useBulkArchive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return ids;
      const { error } = await supabase()
        .from("tasks")
        .update({ archived_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

/** Restore an archived task back to active (clear archived_at). */
export function useRestoreTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase()
        .from("tasks")
        .update({ archived_at: null })
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
 * Permanently delete a task (hard delete -- no recovery). Used only from the
 * Archive view, where the user has explicitly chosen to purge.
 */
export function usePermanentDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase().from("tasks").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
