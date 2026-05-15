"use client";

import { Check, Repeat } from "lucide-react";
import { useHabits, useTodayHabitLogs, useToggleHabitLog } from "@/lib/habits/queries";
import { isHabitDueOn } from "@/lib/habits/dates";
import { cn } from "@/lib/utils";

export function HabitTodayRow({ compact = false }: { compact?: boolean }) {
  const habits = useHabits();
  const logs = useTodayHabitLogs();
  const toggle = useToggleHabitLog();
  const loggedIds = new Set((logs.data ?? []).map((l) => l.habit_id));
  const due = (habits.data ?? []).filter((habit) => isHabitDueOn(habit, new Date()));

  if (due.length === 0) return null;

  return (
    <section className={compact ? "space-y-2" : "pulse-pane p-4"}>
      {!compact && (
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Repeat className="h-3.5 w-3.5" />
          Habits due today
        </h2>
      )}
      <div className={cn("grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {due.map((habit) => {
          const done = loggedIds.has(habit.id);
          const color = habit.color || "#10b981";
          return (
            <button
              key={habit.id}
              type="button"
              onClick={() => toggle.mutate({ habitId: habit.id })}
              disabled={toggle.isPending}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                compact && "rounded-2xl py-3",
                done ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10" : "border-border bg-card hover:bg-muted/50"
              )}
            >
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full border",
                  done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border"
                )}
                style={done ? undefined : { borderColor: color }}
              >
                {done && <Check className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-medium leading-tight", !compact && "truncate")}>
                  {habit.name}
                </span>
                <span className="block text-xs capitalize text-muted-foreground">{habit.cadence}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
