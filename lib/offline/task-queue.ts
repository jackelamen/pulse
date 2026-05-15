"use client";

import type { QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Task, TaskInsert, TaskEditableFields } from "@/lib/tasks/types";

const TASK_QUEUE_KEY = "pulse:offline:task-queue";
const LEGACY_KEY = "pulse:offline:task-create";

/**
 * Offline queue for write ops against the `tasks` table.
 *
 * Three kinds of ops:
 *  - "create" — body is the full insert input. Local id is held so subsequent
 *    edits to a still-queued local task can merge into the same op.
 *  - "update" — patch keyed by server id. Multiple updates to the same id
 *    fold into one merged patch.
 *  - "delete" — soft-delete by server id.
 *
 * Flush semantics:
 *  - Network errors leave the op queued for next reconnect.
 *  - Permanent errors (RLS, validation, missing row) drop the op — the next
 *    invalidation will pull truth from the server and the user can retry.
 *  - On success, the tasks query is invalidated so optimistic offline rows
 *    are replaced by real server rows.
 */

export type QueuedOp =
  | { kind: "create"; id: string; localId: string; input: TaskInsert; createdAt: string }
  | { kind: "update"; id: string; targetId: string; patch: TaskEditableFields; updatedAt: string }
  | { kind: "delete"; id: string; targetId: string; deletedAt: string };

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function isLocalId(id: string): boolean {
  return id.startsWith("offline-");
}

/* ------------------------------------------------------------------ */
/* Storage primitives                                                   */
/* ------------------------------------------------------------------ */

function readQueue(): QueuedOp[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(TASK_QUEUE_KEY);
    if (raw) return JSON.parse(raw) as QueuedOp[];

    // One-time migration from the old create-only queue.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const legacyItems = JSON.parse(legacy) as Array<{ input: TaskInsert; createdAt: string }>;
      const migrated: QueuedOp[] = legacyItems.map((item) => ({
        kind: "create",
        id: crypto.randomUUID(),
        localId: `offline-${crypto.randomUUID()}`,
        input: item.input,
        createdAt: item.createdAt,
      }));
      writeQueue(migrated);
      localStorage.removeItem(LEGACY_KEY);
      return migrated;
    }
    return [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedOp[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(TASK_QUEUE_KEY, JSON.stringify(queue));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pulse-offline-queue-changed"));
  }
}

/* ------------------------------------------------------------------ */
/* Public readers                                                       */
/* ------------------------------------------------------------------ */

export function readTaskQueue(): QueuedOp[] {
  return readQueue();
}

export function queuedTaskCount(): number {
  return readQueue().length;
}

/* ------------------------------------------------------------------ */
/* Synthesizing the optimistic local Task row                           */
/* ------------------------------------------------------------------ */

export function makeQueuedTask(input: TaskInsert, localId?: string): Task {
  const now = new Date().toISOString();
  return {
    id: localId ?? `offline-${crypto.randomUUID()}`,
    user_id: "offline",
    list_id: input.list_id ?? null,
    parent_task_id: input.parent_task_id ?? null,
    title: input.title,
    notes: input.notes ?? null,
    priority: input.priority ?? 0,
    status: input.status ?? "todo",
    start_at: input.start_at ?? null,
    due_at: input.due_at ?? null,
    duration_minutes: input.duration_minutes ?? null,
    all_day: input.all_day ?? false,
    completed_at: input.completed_at ?? null,
    recurrence_rule: input.recurrence_rule ?? null,
    recurrence_parent_id: input.recurrence_parent_id ?? null,
    sort_order: input.sort_order ?? 0,
    tags: input.tags ?? [],
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

/* ------------------------------------------------------------------ */
/* Enqueue helpers                                                      */
/* ------------------------------------------------------------------ */

export function queueTaskCreate(input: TaskInsert): Task {
  const localId = `offline-${crypto.randomUUID()}`;
  const queue = readQueue();
  queue.push({
    kind: "create",
    id: crypto.randomUUID(),
    localId,
    input,
    createdAt: new Date().toISOString(),
  });
  writeQueue(queue);
  return makeQueuedTask(input, localId);
}

/**
 * Enqueue an update. If the target id is still a queued local create, fold
 * the patch into that create's input so the row materializes correctly when
 * the queue eventually flushes — no orphan update against a non-existent id.
 */
export function queueTaskUpdate(targetId: string, patch: TaskEditableFields): void {
  const queue = readQueue();

  if (isLocalId(targetId)) {
    const idx = queue.findIndex((op) => op.kind === "create" && op.localId === targetId);
    if (idx >= 0) {
      const op = queue[idx];
      if (op.kind === "create") {
        op.input = { ...op.input, ...patch };
        writeQueue(queue);
        return;
      }
    }
    // Falling through: the local task is unknown to the queue. Treat as no-op.
    return;
  }

  // Fold consecutive updates to the same server id.
  const existing = queue.find((op) => op.kind === "update" && op.targetId === targetId);
  if (existing && existing.kind === "update") {
    existing.patch = { ...existing.patch, ...patch };
    existing.updatedAt = new Date().toISOString();
    writeQueue(queue);
    return;
  }

  queue.push({
    kind: "update",
    id: crypto.randomUUID(),
    targetId,
    patch,
    updatedAt: new Date().toISOString(),
  });
  writeQueue(queue);
}

export function queueTaskDelete(targetId: string): void {
  const queue = readQueue();

  // If it's a still-queued local create, just drop the create and any updates.
  if (isLocalId(targetId)) {
    const filtered = queue.filter(
      (op) =>
        !(op.kind === "create" && op.localId === targetId)
    );
    writeQueue(filtered);
    return;
  }

  // Drop any pending updates against this id, then enqueue the delete.
  const filtered = queue.filter(
    (op) => !(op.kind === "update" && op.targetId === targetId)
  );
  filtered.push({
    kind: "delete",
    id: crypto.randomUUID(),
    targetId,
    deletedAt: new Date().toISOString(),
  });
  writeQueue(filtered);
}

/* ------------------------------------------------------------------ */
/* Flush                                                                */
/* ------------------------------------------------------------------ */

/**
 * Returns true if the error looks like a transient network failure, in which
 * case we keep the op queued. Anything else (RLS, validation, 4xx) is treated
 * as permanent — the user can retry by re-doing the action after reconnect.
 */
function isTransientError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: string; code?: string };
  const msg = (e.message || "").toLowerCase();
  if (msg.includes("network") || msg.includes("failed to fetch") || msg.includes("offline"))
    return true;
  // Postgres / PostgREST codes that mean "talk to me later".
  if (e.code === "08006" || e.code === "08000" || e.code === "PGRST000") return true;
  return false;
}

export interface FlushResult {
  flushed: number;
  remaining: number;
}

export async function flushTaskQueue(qc?: QueryClient): Promise<FlushResult> {
  if (isOffline()) return { flushed: 0, remaining: readQueue().length };
  const queue = readQueue();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };

  const supabase = createClient();
  const remaining: QueuedOp[] = [];
  let flushed = 0;

  for (const op of queue) {
    try {
      if (op.kind === "create") {
        const { error } = await supabase.from("tasks").insert(op.input);
        if (error) {
          if (isTransientError(error)) {
            remaining.push(op);
          }
          // permanent error → drop the op
          continue;
        }
        flushed += 1;
        continue;
      }

      if (op.kind === "update") {
        const { error } = await supabase.from("tasks").update(op.patch).eq("id", op.targetId);
        if (error) {
          if (isTransientError(error)) remaining.push(op);
          continue;
        }
        flushed += 1;
        continue;
      }

      // delete (soft)
      const { error } = await supabase
        .from("tasks")
        .update({ deleted_at: op.deletedAt })
        .eq("id", op.targetId);
      if (error) {
        if (isTransientError(error)) remaining.push(op);
        continue;
      }
      flushed += 1;
    } catch (err) {
      if (isTransientError(err)) remaining.push(op);
    }
  }

  writeQueue(remaining);

  if (flushed > 0 && qc) {
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  return { flushed, remaining: remaining.length };
}
