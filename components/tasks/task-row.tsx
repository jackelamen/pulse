"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CalendarClock, Flag, Repeat, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  useToggleComplete,
  useUpdateTask,
  useDeleteTask,
  useMaterializeException,
} from "@/lib/tasks/queries";
import { useTags } from "@/lib/lists/queries";
import { useUi } from "@/lib/ui/store";
import { tagColor } from "@/lib/lists/tag-colors";
import { recurrenceLabel } from "@/lib/tasks/recurrence";
import type { Task } from "@/lib/tasks/types";
import type { VirtualTask } from "@/lib/tasks/recurrence";

export function TaskRow({
  task,
  dense = false,
}: {
  task: Task | VirtualTask;
  dense?: boolean;
}) {
  const toggle = useToggleComplete();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const materialize = useMaterializeException();
  const tags = useTags();
  const openTask = useUi((s) => s.openTask);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [dragX, setDragX] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  const isVirtual = "virtual" in task && task.virtual === true;
  const done = !!task.completed_at;

  async function handleToggle() {
    setError(null);
    try {
      if (isVirtual) {
        const v = task as VirtualTask;
        await materialize.mutateAsync({
          templateId: v.template_id!,
          occursOn: v.occurs_on,
          patch: { completed_at: new Date().toISOString(), status: "done" },
        });
        return;
      }
      await toggle.mutateAsync(task as Task);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function commit() {
    setEditing(false);
    const next = draft.trim();
    if (!next) {
      if (!isVirtual) remove.mutate(task.id);
      return;
    }
    if (next === task.title) return;
    if (isVirtual) {
      const v = task as VirtualTask;
      await materialize.mutateAsync({
        templateId: v.template_id!,
        occursOn: v.occurs_on,
        patch: { title: next },
      });
      return;
    }
    update.mutate({ id: task.id, patch: { title: next } });
  }

  function onTouchStart(e: React.TouchEvent) {
    if (editing) return;
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null || editing) return;
    const x = e.touches[0]?.clientX ?? touchStartX.current;
    const delta = x - touchStartX.current;
    if (Math.abs(delta) < 8) return;
    setDragX(Math.max(-96, Math.min(96, delta)));
  }

  function onTouchEnd() {
    if (dragX > 72) handleToggle();
    if (dragX < -72) openTask(task.id);
    setDragX(0);
    touchStartX.current = null;
  }

  return (
    <li
      className="relative overflow-hidden rounded-lg touch-pan-y"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 hidden w-28 items-center bg-emerald-500 px-4 text-xs font-medium text-white transition-opacity md:hidden",
          dragX > 8 ? "flex opacity-100" : "opacity-0"
        )}
      >
        Complete
      </div>
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 hidden w-28 items-center justify-end bg-muted px-4 text-xs font-medium text-muted-foreground transition-opacity md:hidden",
          dragX < -8 ? "flex opacity-100" : "opacity-0"
        )}
      >
        Details
      </div>

      <div
        className={cn(
          "group relative z-10 flex items-start gap-3 rounded-xl border border-border/70 bg-card px-3.5 shadow-[0_1px_2px_rgba(20,24,45,0.04)] transition-colors hover:border-border hover:bg-muted/35 hover:shadow-[0_10px_26px_rgba(20,24,45,0.07)]",
          dense ? "py-2" : "py-3",
          dragX === 0 && "transition-transform"
        )}
        style={{ transform: `translateX(${dragX}px)` }}
      >
        <div className="pt-1">
          <Checkbox
            checked={done}
            onCheckedChange={() => handleToggle()}
            priority={task.priority}
            aria-label={done ? `Uncomplete ${task.title}` : `Complete ${task.title}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                } else if (e.key === "Escape") {
                  setDraft(task.title);
                  setEditing(false);
                }
              }}
              className="w-full bg-transparent text-sm outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={cn(
                "block w-full truncate text-left text-sm transition-colors",
                !done && "font-medium text-foreground",
                done && "text-muted-foreground line-through decoration-muted-foreground/50"
              )}
            >
              {task.title}
            </button>
          )}

          {(task.due_at || task.start_at || task.tags.length > 0 || task.priority > 0 || task.recurrence_rule) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              {(task.due_at || task.start_at) && (
                <span className="pulse-chip">
                  <CalendarClock className="h-3 w-3" />
                  {formatDueChip((task.start_at ?? task.due_at)!, task.all_day)}
                </span>
              )}
              {task.recurrence_rule && (
                <span className="pulse-chip">
                  <Repeat className="h-3 w-3" />
                  {recurrenceLabel(task.recurrence_rule)}
                </span>
              )}
              {task.priority > 0 && (
                <span className="pulse-chip">
                  <Flag className="h-3 w-3" />
                  {priorityLabel(task.priority)}
                </span>
              )}
              {task.tags.map((name) => {
                const explicit = tags.data?.find((t) => t.name === name)?.color;
                const c = tagColor(name, explicit);
                return (
                  <Link
                    key={name}
                    href={`/tags/${encodeURIComponent(name)}`}
                    className="pulse-chip transition-colors hover:bg-muted"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: c }}
                    />
                    <span className="text-muted-foreground">{name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Hover affordance: open task detail */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openTask(task.id);
          }}
          className="self-center opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="Open details"
          title="Open details"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      {error && (
        <div className="mt-1 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
    </li>
  );
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    const message = typeof record.message === "string" ? record.message : null;
    const details = typeof record.details === "string" ? record.details : null;
    const hint = typeof record.hint === "string" ? record.hint : null;
    return [message, details, hint].filter(Boolean).join(" ") || JSON.stringify(record);
  }
  return "Could not update task.";
}

function priorityLabel(p: 0 | 1 | 2 | 3) {
  return p === 3 ? "High" : p === 2 ? "Medium" : p === 1 ? "Low" : "";
}

function formatDueChip(iso: string, allDay: boolean) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diffDays = Math.round((day.getTime() - today.getTime()) / 86400000);

  let dayLabel: string;
  if (diffDays === 0) dayLabel = "Today";
  else if (diffDays === 1) dayLabel = "Tomorrow";
  else if (diffDays === -1) dayLabel = "Yesterday";
  else if (diffDays > 1 && diffDays < 7)
    dayLabel = d.toLocaleDateString(undefined, { weekday: "long" });
  else dayLabel = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  if (allDay) return dayLabel;
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dayLabel} ${time}`;
}
