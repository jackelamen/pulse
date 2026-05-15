"use client";

import { CheckCircle2, Flame, ListChecks, Timer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskList } from "@/components/tasks/task-list";
import { useRecentCompletedTasks } from "@/lib/tasks/queries";
import { useDeleteHabitLog, useHabits, useHabitLogsWindow } from "@/lib/habits/queries";
import { useDeleteFocusSession, useRecentFocusSessions } from "@/lib/focus/queries";
import { addDays, dayLabel, startOfDay } from "@/lib/date";
import { localDateKey, parseLocalDateKey } from "@/lib/habits/dates";
import type { Task } from "@/lib/tasks/types";

export function LogbookClient() {
  const tasks = useRecentCompletedTasks();
  const habits = useHabits();
  const habitLogs = useHabitLogsWindow(addDays(new Date(), -29), new Date());
  const focus = useRecentFocusSessions();
  const deleteHabitLog = useDeleteHabitLog();
  const deleteFocusSession = useDeleteFocusSession();

  const taskGroups = groupTasksByDay(tasks.data ?? []);
  const habitName = new Map((habits.data ?? []).map((habit) => [habit.id, habit.name]));
  const focusMinutes = (focus.data ?? []).reduce(
    (sum, session) => sum + (session.actual_minutes ?? session.planned_minutes ?? 0),
    0
  );
  const habitDoneCount = (habitLogs.data ?? []).reduce((sum, log) => sum + log.count, 0);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={CheckCircle2} label="Tasks done" value={tasks.data?.length ?? 0} />
        <SummaryCard icon={Flame} label="Habits logged" value={habitDoneCount} />
        <SummaryCard icon={Timer} label="Focus minutes" value={focusMinutes} />
      </section>

      <section className="pulse-pane p-4">
        <div className="mb-3 flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <h2 className="pulse-section-label">Completed tasks</h2>
        </div>
        {tasks.isLoading ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">Loading...</p>
        ) : taskGroups.length === 0 ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">
            Nothing completed yet. Completed tasks will collect here.
          </p>
        ) : (
          <div className="space-y-5">
            {taskGroups.map((group) => (
              <section key={group.key}>
                <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h3>
                <TaskList tasks={group.tasks} dense />
              </section>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <section className="pulse-pane p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="pulse-section-label">Habit history</h2>
            {(habitLogs.data ?? []).length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={deleteHabitLog.isPending}
                onClick={() => {
                  const logs = habitLogs.data ?? [];
                  const ok = window.confirm(
                    `Remove ${logs.length} visible habit log entr${logs.length === 1 ? "y" : "ies"} from Logbook? This keeps the habits.`
                  );
                  if (!ok) return;
                  void Promise.all(logs.map((log) => deleteHabitLog.mutateAsync(log.id)));
                }}
              >
                Clear visible
              </Button>
            )}
          </div>
          {(habitLogs.data ?? []).length === 0 ? (
            <p className="px-1 py-5 text-sm text-muted-foreground">No habit logs yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {(habitLogs.data ?? []).slice(-12).reverse().map((log) => (
                <li
                  key={log.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="min-w-0 flex-1 truncate">
                    {habitName.get(log.habit_id) ?? "Habit"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {dayLabel(parseLocalDateKey(log.logged_on), new Date())}
                  </span>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    disabled={deleteHabitLog.isPending}
                    onClick={() => deleteHabitLog.mutate(log.id)}
                    aria-label="Remove habit log"
                    title="Remove habit log"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pulse-pane p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="pulse-section-label">Focus history</h2>
            {(focus.data ?? []).length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={deleteFocusSession.isPending}
                onClick={() => {
                  const sessions = focus.data ?? [];
                  const ok = window.confirm(
                    `Remove ${sessions.length} visible focus session${sessions.length === 1 ? "" : "s"} from Logbook?`
                  );
                  if (!ok) return;
                  void Promise.all(sessions.map((session) => deleteFocusSession.mutateAsync(session.id)));
                }}
              >
                Clear visible
              </Button>
            )}
          </div>
          {(focus.data ?? []).length === 0 ? (
            <p className="px-1 py-5 text-sm text-muted-foreground">No focus sessions yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {(focus.data ?? []).map((session) => (
                <li
                  key={session.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
                    <Timer className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {session.actual_minutes ?? session.planned_minutes} minutes
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {focusSessionLabel(session)}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {dayLabel(new Date(session.started_at), new Date())}
                  </span>
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    disabled={deleteFocusSession.isPending}
                    onClick={() => deleteFocusSession.mutate(session.id)}
                    aria-label="Remove focus session"
                    title="Remove focus session"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
}) {
  return (
    <div className="pulse-pane flex items-center gap-3 px-4 py-3">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span>
        <span className="block font-display text-2xl font-semibold leading-none">{value}</span>
        <span className="mt-1 block text-xs font-medium text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

function groupTasksByDay(tasks: Task[]) {
  const today = new Date();
  const map = new Map<string, Task[]>();
  for (const task of tasks) {
    if (!task.completed_at) continue;
    const key = localDateKey(new Date(task.completed_at));
    map.set(key, [...(map.get(key) ?? []), task]);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, groupTasks]) => ({
      key,
      label: dayLabel(startOfDay(parseLocalDateKey(key)), today),
      tasks: groupTasks,
    }));
}

function focusSessionLabel(session: { notes?: unknown; mode?: unknown }) {
  if (typeof session.notes === "string" && session.notes.trim()) return session.notes;
  if (typeof session.mode === "string") return session.mode;
  return "Focus session";
}
