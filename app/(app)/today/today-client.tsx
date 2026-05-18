"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronDown,
  Flag,
  ListChecks,
  MoreHorizontal,
  Repeat,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskList } from "@/components/tasks/task-list";
import { TaskRow } from "@/components/tasks/task-row";
import {
  useTodayTasks,
  useCompletedTodayTasks,
  useLeftoverTasks,
  useRescheduleLeftovers,
  useToggleComplete,
} from "@/lib/tasks/queries";
import { useLast7FocusSessions } from "@/lib/focus/queries";
import { useHabits, useTodayHabitLogs, useToggleHabitLog } from "@/lib/habits/queries";
import { useLists } from "@/lib/lists/queries";
import { isHabitDueOn } from "@/lib/habits/dates";
import { isSameDay } from "@/lib/date";
import { useUi } from "@/lib/ui/store";
import { formatDateLong } from "@/lib/utils";
import type { Task } from "@/lib/tasks/types";
import type { Habit } from "@/lib/habits/types";
import { useRouter } from "next/navigation";

type TodayHeaderState = {
  dateLabel: string;
  greeting: string;
};

export function TodayClient({ firstName }: { firstName: string | null }) {
  const today = useTodayTasks();
  const completedToday = useCompletedTodayTasks();
  const leftovers = useLeftoverTasks();
  const focusSessions = useLast7FocusSessions();
  const habits = useHabits();
  const habitLogs = useTodayHabitLogs();
  const lists = useLists();
  const reschedule = useRescheduleLeftovers();
  const [showDone, setShowDone] = useState(false);

  const { scheduled, anytime } = useMemo(() => groupToday(today.data ?? []), [today.data]);
  const priorityTasks = useMemo(
    () =>
      (today.data ?? [])
        .filter((task) => task.priority >= 2)
        .sort((a, b) => b.priority - a.priority || timeValue(a) - timeValue(b))
        .slice(0, 5),
    [today.data]
  );
  const priorityIds = useMemo(() => new Set(priorityTasks.map((task) => task.id)), [priorityTasks]);
  const flexibleTasks = useMemo(
    () => anytime.filter((task) => !priorityIds.has(task.id)),
    [anytime, priorityIds]
  );
  const done = useMemo(() => completedToday.data ?? [], [completedToday.data]);
  const dueHabits = (habits.data ?? []).filter((habit) => isHabitDueOn(habit, new Date()));
  const loggedHabitIds = useMemo(
    () => new Set((habitLogs.data ?? []).map((log) => log.habit_id)),
    [habitLogs.data]
  );
  const doneHabits = (habitLogs.data ?? []).map((log) => ({
    ...log,
    name: habits.data?.find((habit) => habit.id === log.habit_id)?.name ?? "Habit",
  }));
  const projectNames = useMemo(
    () => new Map((lists.data ?? []).map((list) => [list.id, list.name])),
    [lists.data]
  );
  const projectProgress = useMemo(
    () => buildProjectProgress([...(today.data ?? []), ...done], projectNames),
    [today.data, done, projectNames]
  );

  return (
    <div className="space-y-6">
      {(leftovers.data ?? []).length > 0 && (
        <LeftoverSection
          tasks={leftovers.data!}
          onBulk={(target) =>
            reschedule.mutate({ ids: leftovers.data!.map((t) => t.id), target })
          }
          pending={reschedule.isPending}
        />
      )}

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <main className="space-y-5">
          <DashboardHero
            firstName={firstName}
            openCount={(today.data ?? []).length}
            scheduledCount={scheduled.length}
            priorityCount={priorityTasks.length}
            habitCount={dueHabits.length}
            doneCount={done.length}
            completionPercent={completionPercent(today.data ?? [], done)}
          />

          <section>
            <SectionHeader>Quick capture</SectionHeader>
            <QuickAdd placeholder="Add task, time, duration, or tag" />
          </section>

          <PriorityPanel tasks={priorityTasks} projectNames={projectNames} />
          <AnytimePanel tasks={flexibleTasks} doneCount={done.length} />

          {(done.length > 0 || doneHabits.length > 0) && (
            <section>
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/50"
              >
                <span>
                  Done today · {done.length} tasks · {doneHabits.length} habits
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showDone ? "rotate-180" : ""}`}
                />
              </button>
              {showDone && (
                <div className="mt-1 space-y-3">
                  {done.length > 0 && (
                    <ul className="space-y-0.5">
                      {done.map((t) => (
                        <TaskRow key={t.id} task={t} dense />
                      ))}
                    </ul>
                  )}
                  {doneHabits.length > 0 && (
                    <ul className="space-y-1 px-2">
                      {doneHabits.map((habit) => (
                        <li
                          key={habit.id}
                          className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm"
                        >
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span className="flex-1 truncate">{habit.name}</span>
                          <span className="text-xs text-muted-foreground">Habit</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          )}
        </main>

        <TodayRail
          tasks={scheduled}
          habits={dueHabits}
          loggedHabitIds={loggedHabitIds}
          sessions={focusSessions.data ?? []}
          projectProgress={projectProgress}
        />
      </section>
    </div>
  );
}

function DashboardHero({
  firstName,
  openCount,
  scheduledCount,
  priorityCount,
  habitCount,
  doneCount,
  completionPercent,
}: {
  firstName: string | null;
  openCount: number;
  scheduledCount: number;
  priorityCount: number;
  habitCount: number;
  doneCount: number;
  completionPercent: number;
}) {
  const [header, setHeader] = useState<TodayHeaderState>({
    dateLabel: "",
    greeting: "Today",
  });

  useEffect(() => {
    const now = new Date();
    setHeader({
      dateLabel: formatDateLong(now),
      greeting: greetingFor(now),
    });
  }, []);

  const greeting = `${header.greeting}${
    firstName && header.greeting !== "Today" ? `, ${firstName}` : ""
  }`;
  const items = [
    { label: "Open tasks", value: openCount, icon: CalendarClock, meta: `${scheduledCount} timed` },
    { label: "Priorities", value: priorityCount, icon: Flag, meta: "Needs attention" },
    { label: "Habits", value: habitCount, icon: Repeat, meta: `${completionPercent}% complete` },
    { label: "Done", value: doneCount, icon: ListChecks, meta: "Closed loop" },
  ];

  return (
    <section
      className="overflow-hidden rounded-2xl border border-white/10 p-4 text-white shadow-[0_18px_48px_rgba(3,10,25,0.18)] md:p-5"
      style={{ background: "var(--pulse-sidebar-rail)" }}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(420px,1fr)] lg:items-center">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/65 md:text-xs">
            {header.dateLabel}
          </p>
          <h1 className="mt-2 truncate font-display text-3xl font-semibold leading-none tracking-tight text-white md:text-4xl">
            {greeting}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-5 text-white/68">
            Ready for the day? Here is your prioritized pulse.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {items.map(({ label, value, icon: Icon, meta }) => (
            <div
              key={label}
              className="rounded-xl border border-white/12 bg-white/[0.08] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            >
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/10 text-white ring-1 ring-white/10">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 truncate text-[10px] font-semibold leading-tight text-white/58">
                  {meta}
                </div>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <div className="font-display text-3xl font-semibold leading-none text-white md:text-4xl">{value}</div>
                <div className="pb-0.5 text-xs font-semibold leading-tight text-white/70 md:text-sm">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function greetingFor(d: Date) {
  const h = d.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function PriorityPanel({
  tasks,
  projectNames,
}: {
  tasks: Task[];
  projectNames: Map<string, string>;
}) {
  const toggle = useToggleComplete();

  return (
    <section className="pulse-pane overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <SectionHeader className="mb-0">Priority queue</SectionHeader>
        <MoreHorizontal className="ml-auto h-4 w-4 text-muted-foreground" />
      </div>
      {tasks.length === 0 ? (
        <p className="m-5 rounded-xl bg-muted/40 px-4 py-5 text-sm font-medium text-muted-foreground">
          No priority tasks in today’s plan.
        </p>
      ) : (
        <div>
          <div className="hidden grid-cols-[minmax(0,1.7fr)_0.75fr_0.9fr_0.7fr] gap-4 border-b border-border bg-muted/40 px-7 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Title</span>
            <span>Severity</span>
            <span>Project</span>
            <span>Due</span>
          </div>
          <ul className="divide-y divide-border">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.7fr)_0.75fr_0.9fr_0.7fr] md:items-center md:gap-4 md:px-7"
            >
              <div className="flex min-w-0 items-start gap-3">
                <Checkbox
                  checked={!!task.completed_at}
                  onCheckedChange={() => toggle.mutate(task)}
                  priority={task.priority}
                  aria-label={`Complete ${task.title}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold leading-snug text-foreground">{task.title}</div>
                  {task.tags?.[0] && <div className="mt-1 text-xs text-muted-foreground">#{task.tags[0]}</div>}
                </div>
              </div>
              <div>
                <span className={priorityBadgeClass(task.priority)}>{priorityWord(task.priority)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="truncate">{task.list_id ? projectNames.get(task.list_id) ?? "Project" : "No project"}</span>
              </div>
              <div className="text-sm font-medium text-muted-foreground">
                {task.start_at || task.due_at ? formatCompactDue(task) : "Today"}
              </div>
            </li>
          ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function AnytimePanel({ tasks, doneCount }: { tasks: Task[]; doneCount: number }) {
  return (
    <section className="pulse-pane p-5">
      <SectionHeader>Flexible today</SectionHeader>
      <TaskList
        tasks={tasks}
        sortable
        emptyMessage={
          doneCount === 0 ? (
            <span>
              Nothing flexible yet. Press <span className="pulse-kbd">N</span> or use quick capture.
            </span>
          ) : (
            <span>No flexible tasks left for today.</span>
          )
        }
      />
    </section>
  );
}

function TodayRail({
  tasks,
  habits,
  loggedHabitIds,
  sessions,
  projectProgress,
}: {
  tasks: Task[];
  habits: Habit[];
  loggedHabitIds: Set<string>;
  sessions: Array<{ started_at: string; actual_minutes: number | null; planned_minutes: number }>;
  projectProgress: Array<{ id: string; name: string; percent: number; color: string }>;
}) {
  return (
    <aside
      className="overflow-hidden rounded-[1.5rem] text-white shadow-[0_24px_64px_rgba(3,10,25,0.24)] ring-1 ring-white/10 xl:sticky xl:top-6"
      style={{ background: "var(--pulse-sidebar-rail)" }}
    >
      <div className="space-y-6 p-5">
        <DarkTimeline tasks={tasks} />
        <DarkHabitPanel habits={habits} loggedHabitIds={loggedHabitIds} />
        <ProjectProgressPanel projects={projectProgress} />
      </div>
      <FocusDock sessions={sessions} />
    </aside>
  );
}

function DarkTimeline({ tasks }: { tasks: Task[] }) {
  const openTask = useUi((s) => s.openTask);
  const toggle = useToggleComplete();

  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <DarkSectionHeader>Today timeline</DarkSectionHeader>
        <span className="ml-auto rounded-full bg-white/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/80">
          Live
        </span>
      </div>
      {tasks.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-4 text-sm font-medium text-white/75">
          No timed tasks yet.
        </div>
      ) : (
        <ol className="relative space-y-7 before:absolute before:left-2 before:top-3 before:h-[calc(100%-1.5rem)] before:w-px before:bg-white/20">
          {tasks.map((task, index) => (
            <li key={task.id} className="relative pl-9">
              <span
                className={`absolute left-0 top-1.5 h-4 w-4 rounded-full ring-4 ring-white/10 ${
                  index % 2 === 0 ? "bg-white" : "bg-primary"
                }`}
              />
              <div className="mb-2 text-sm font-semibold tracking-wide text-white/75">
                {formatTaskRange(task)}
              </div>
              <button
                type="button"
                onClick={() => openTask(task.id)}
                className="group flex w-full items-start gap-3 rounded-2xl border border-white/12 bg-white/[0.09] px-4 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors hover:border-white/20 hover:bg-white/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                aria-label={`Edit ${task.title}`}
              >
                <Checkbox
                  checked={!!task.completed_at}
                  onCheckedChange={() => toggle.mutate(task)}
                  priority={task.priority}
                  className="mt-0.5 border-white/50 bg-transparent hover:border-white"
                  aria-label={task.completed_at ? `Mark ${task.title} incomplete` : `Complete ${task.title}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold text-white group-hover:text-white">
                    {task.title}
                  </div>
                  <div className="mt-1 text-sm text-white/65">
                    {task.duration_minutes ? `${task.duration_minutes} minutes` : "No duration set"}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function DarkHabitPanel({
  habits,
  loggedHabitIds,
}: {
  habits: Habit[];
  loggedHabitIds: Set<string>;
}) {
  const toggle = useToggleHabitLog();
  const router = useRouter();

  return (
    <section className="border-t border-white/10 pt-5">
      <div className="mb-3 flex items-center gap-3">
        <DarkSectionHeader>Habits due today</DarkSectionHeader>
        <Repeat className="ml-auto h-4 w-4 text-white/55" />
      </div>
      {habits.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-4 text-sm text-white/75">
          No habits due today.
        </p>
      ) : (
        <div className="space-y-2">
          {habits.map((habit) => {
            const done = loggedHabitIds.has(habit.id);
            const color = habit.color || "#34d399";
            return (
              <div
                key={habit.id}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 text-left transition-colors hover:bg-white/[0.09]"
              >
                <button
                  type="button"
                  onClick={() => toggle.mutate({ habitId: habit.id })}
                  disabled={toggle.isPending}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2"
                  style={{
                    borderColor: color,
                    backgroundColor: done ? color : "transparent",
                  }}
                  aria-label={done ? `Unlog ${habit.name}` : `Log ${habit.name}`}
                >
                  {done && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/habits?habit=${encodeURIComponent(habit.id)}`)}
                  className="min-w-0 flex-1 text-left"
                  aria-label={`Edit ${habit.name}`}
                >
                  <span className="block truncate text-sm font-semibold text-white">{habit.name}</span>
                  <span className="block text-xs capitalize text-white/55">{habit.cadence}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ProjectProgressPanel({
  projects,
}: {
  projects: Array<{ id: string; name: string; percent: number; color: string }>;
}) {
  if (projects.length === 0) return null;

  return (
    <section className="border-t border-white/10 pt-7">
      <DarkSectionHeader>Project progress</DarkSectionHeader>
      <div className="mt-5 space-y-5">
        {projects.map((project) => (
          <div key={project.id}>
            <div className="mb-2 flex items-center gap-3 text-sm font-semibold text-white/85">
              <span className="truncate">{project.name}</span>
              <span className="ml-auto" style={{ color: project.color }}>
                {project.percent}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/18">
              <div
                className="h-full rounded-full"
                style={{ width: `${project.percent}%`, backgroundColor: project.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FocusDock({
  sessions,
}: {
  sessions: Array<{ started_at: string; actual_minutes: number | null; planned_minutes: number }>;
}) {
  const today = new Date();
  const todayMinutes = sessions
    .filter((s) => isSameDay(new Date(s.started_at), today))
    .reduce((sum, s) => sum + (s.actual_minutes ?? s.planned_minutes), 0);
  const weekMinutes = sessions.reduce((sum, s) => sum + (s.actual_minutes ?? s.planned_minutes), 0);

  return (
    <section className="border-t border-white/10 bg-black/15 px-6 py-5">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
        <Timer className="h-5 w-5" />
        <div className="text-sm font-semibold text-white/85">
          {todayMinutes} focus min today
        </div>
        <div className="ml-auto text-xs text-white/45">{weekMinutes} week</div>
      </div>
    </section>
  );
}

function SectionHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h2 className={`pulse-section-label mb-3 text-[12px] text-foreground/70 ${className}`}>{children}</h2>;
}

function DarkSectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/75">
      {children}
    </h2>
  );
}

function LeftoverSection({
  tasks,
  onBulk,
  pending,
}: {
  tasks: Task[];
  onBulk: (target: "today" | "tomorrow" | "inbox") => void;
  pending: boolean;
}) {
  return (
    <section className="rounded-xl border border-amber-300/50 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          Leftover from yesterday · {tasks.length}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" disabled={pending} onClick={() => onBulk("today")}>
            All to today
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => onBulk("tomorrow")}>
            Push to tomorrow
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => onBulk("inbox")}>
            Send to inbox
          </Button>
        </div>
      </div>
      <TaskList tasks={tasks} dense />
    </section>
  );
}

function completionPercent(openTasks: Task[], doneTasks: Task[]) {
  const total = openTasks.length + doneTasks.length;
  if (total === 0) return 0;
  return Math.round((doneTasks.length / total) * 100);
}

function buildProjectProgress(tasks: Task[], projectNames: Map<string, string>) {
  const colors = ["#34d399", "#60a5fa", "#f59e0b"];
  const groups = new Map<string, { id: string; name: string; total: number; done: number }>();

  for (const task of tasks) {
    if (!task.list_id) continue;
    const current = groups.get(task.list_id) ?? {
      id: task.list_id,
      name: projectNames.get(task.list_id) ?? "Project",
      total: 0,
      done: 0,
    };
    current.total += 1;
    if (task.completed_at) current.done += 1;
    groups.set(task.list_id, current);
  }

  return Array.from(groups.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map((project, index) => ({
      id: project.id,
      name: project.name,
      percent: project.total === 0 ? 0 : Math.round((project.done / project.total) * 100),
      color: colors[index % colors.length],
    }));
}

function priorityWord(priority: Task["priority"]) {
  if (priority >= 3) return "High";
  if (priority === 2) return "Medium";
  if (priority === 1) return "Low";
  return "None";
}

function priorityBadgeClass(priority: Task["priority"]) {
  const base =
    "inline-flex rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wider";
  if (priority >= 3) return `${base} bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200`;
  if (priority === 2) return `${base} bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200`;
  return `${base} bg-muted text-muted-foreground`;
}

function formatCompactDue(task: Task) {
  const iso = task.start_at ?? task.due_at;
  if (!iso) return "Today";
  const date = new Date(iso);
  if (task.start_at && task.duration_minutes) {
    return `${formatShortTime(date)} · ${task.duration_minutes}m`;
  }
  return task.all_day ? "Today" : formatShortTime(date);
}

function formatTaskRange(task: Task) {
  if (!task.start_at) return "Anytime";
  const start = new Date(task.start_at);
  if (!task.duration_minutes) return formatShortTime(start);
  const end = new Date(start.getTime() + task.duration_minutes * 60000);
  return `${formatShortTime(start)} - ${formatShortTime(end)}`;
}

function formatShortTime(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/* Grouping                                                            */
/* ------------------------------------------------------------------ */

function groupToday(tasks: Task[]) {
  const scheduled: Task[] = [];
  const anytime: Task[] = [];

  for (const t of tasks) {
    if (t.start_at) scheduled.push(t);
    else anytime.push(t);
  }

  scheduled.sort((a, b) => timeValue(a) - timeValue(b));
  anytime.sort((a, b) => b.priority - a.priority || timeValue(a) - timeValue(b));

  return { scheduled, anytime };
}

function timeValue(task: Task) {
  return task.start_at ? new Date(task.start_at).getTime() : Number.MAX_SAFE_INTEGER;
}
