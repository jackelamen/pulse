"use client";

import { CalendarClock, CheckCircle2, Clock3 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useTodayTasks, useToggleComplete } from "@/lib/tasks/queries";
import type { Task } from "@/lib/tasks/types";
import { useUi } from "@/lib/ui/store";

export function TimelineClient() {
  const today = useTodayTasks();
  const scheduled = (today.data ?? [])
    .filter((task) => task.start_at)
    .sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));

  return (
    <section className="pulse-pane overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4 md:px-7">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Clock3 className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display text-lg font-semibold text-foreground">Today&apos;s timeline</div>
          <div className="text-xs text-muted-foreground">
            {scheduled.length} timed task{scheduled.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {today.isLoading ? (
        <div className="px-7 py-10 text-sm text-muted-foreground">Loading timeline...</div>
      ) : scheduled.length === 0 ? (
        <div className="m-5 rounded-2xl border border-dashed border-border bg-muted/35 px-5 py-10 text-sm text-muted-foreground md:m-7">
          No timed tasks yet. Add a start time and duration to a task to place it here.
        </div>
      ) : (
        <div className="relative m-5 md:m-7">
          <div className="absolute bottom-8 left-[5.7rem] top-5 hidden w-px bg-border md:block" />
          <ol className="relative space-y-5 md:space-y-6">
            {scheduled.map((task) => (
              <TimelineTask key={task.id} task={task} />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function TimelineTask({ task }: { task: Task }) {
  const openTask = useUi((s) => s.openTask);
  const toggle = useToggleComplete();

  return (
    <li className="grid gap-3 md:grid-cols-[5rem_1rem_minmax(0,1fr)] md:items-start">
      <div className="text-sm font-semibold text-muted-foreground md:pt-5 md:text-right">
        {formatTaskRange(task)}
      </div>
      <div className="relative hidden justify-center md:flex md:pt-6">
        <span className="relative z-10 h-4 w-4 rounded-full bg-primary ring-4 ring-primary/15" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_10px_30px_rgba(20,24,45,0.06)] transition-colors hover:border-primary/25">
        <div className="flex min-w-0 items-start gap-3">
          <Checkbox
            checked={!!task.completed_at}
            onCheckedChange={() => toggle.mutate(task)}
            priority={task.priority}
            className="mt-1"
            aria-label={task.completed_at ? `Mark ${task.title} incomplete` : `Complete ${task.title}`}
          />
          <button
            type="button"
            onClick={() => openTask(task.id)}
            className="min-w-0 flex-1 text-left"
            aria-label={`Edit ${task.title}`}
          >
            <div className="truncate text-lg font-semibold leading-tight text-foreground">{task.title}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                <CalendarClock className="h-3.5 w-3.5" />
                {task.duration_minutes ? `${task.duration_minutes} min` : "No duration"}
              </span>
              {task.priority > 0 && (
                <span className={priorityPillClass(task.priority)}>{priorityLabel(task.priority)}</span>
              )}
              {task.tags?.map((tag) => (
                <span key={tag} className="rounded-full bg-muted px-2.5 py-1">
                  #{tag}
                </span>
              ))}
              {task.completed_at && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-600 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Done
                </span>
              )}
            </div>
          </button>
        </div>
      </div>
    </li>
  );
}

function formatTaskRange(task: Task) {
  if (!task.start_at) return "Anytime";
  const start = new Date(task.start_at);
  if (!task.duration_minutes) return formatShortTime(start);
  const end = new Date(start.getTime() + task.duration_minutes * 60_000);
  return `${formatShortTime(start)} - ${formatShortTime(end)}`;
}

function formatShortTime(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function priorityLabel(priority: Task["priority"]) {
  if (priority >= 3) return "High";
  if (priority === 2) return "Medium";
  if (priority === 1) return "Low";
  return "None";
}

function priorityPillClass(priority: Task["priority"]) {
  const base = "rounded-full px-2.5 py-1";
  if (priority >= 3) return `${base} bg-rose-500/10 text-rose-600 dark:text-rose-300`;
  if (priority === 2) return `${base} bg-amber-500/10 text-amber-700 dark:text-amber-300`;
  return `${base} bg-sky-500/10 text-sky-600 dark:text-sky-300`;
}
