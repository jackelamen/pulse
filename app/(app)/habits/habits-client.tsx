"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Archive,
  BookOpen,
  CalendarCheck,
  Check,
  ChevronRight,
  Dumbbell,
  Flame,
  HeartPulse,
  Moon,
  Pill,
  Plus,
  Repeat,
  Smile,
  Sparkles,
  Sprout,
  Sun,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useArchiveHabit,
  useCreateHabit,
  useHabits,
  useLast90HabitLogs,
  useToggleHabitLog,
  useUpdateHabit,
} from "@/lib/habits/queries";
import {
  completionMap,
  currentStreak,
  isHabitDueOn,
  localDateKey,
  longestStreak,
  monthCompletionRate,
  readDaysConfig,
} from "@/lib/habits/dates";
import { addDays, startOfDay } from "@/lib/date";
import type { Habit, HabitCadence, HabitLog } from "@/lib/habits/types";
import { cn } from "@/lib/utils";

const COLORS = ["#10b981", "#f25c2a", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"];
const WEEKDAYS = [
  { day: 1, label: "M" },
  { day: 2, label: "T" },
  { day: 3, label: "W" },
  { day: 4, label: "T" },
  { day: 5, label: "F" },
  { day: 6, label: "S" },
  { day: 0, label: "S" },
];

export function HabitsClient() {
  const searchParams = useSearchParams();
  const habits = useHabits();
  const logs = useLast90HabitLogs();
  const allLogs = logs.data ?? [];
  const allHabits = useMemo(() => habits.data ?? [], [habits.data]);
  const dueToday = useMemo(
    () => allHabits.filter((habit) => isHabitDueOn(habit, new Date())),
    [allHabits]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const requestedHabitId = searchParams.get("habit");

  useEffect(() => {
    if (!requestedHabitId) return;
    if (allHabits.some((habit) => habit.id === requestedHabitId)) {
      setSelectedId(requestedHabitId);
    }
  }, [allHabits, requestedHabitId]);

  const selectedHabit =
    allHabits.find((habit) => habit.id === selectedId) ?? dueToday[0] ?? allHabits[0] ?? null;

  return (
    <div className="space-y-5">
      {allHabits.length === 0 ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.85fr)_minmax(0,1.15fr)]">
          <div className="space-y-5">
            <HabitWeekStrip habits={allHabits} logs={allLogs} />
            <NewHabitForm />
          </div>
          <div className="pulse-pane flex min-h-[28rem] items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
            No habits yet.
          </div>
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-5">
            <HabitWeekStrip habits={allHabits} logs={allLogs} />
            <HabitListPanel
              habits={allHabits}
              dueToday={dueToday}
              logs={allLogs}
              selectedId={selectedHabit?.id ?? null}
              onSelect={setSelectedId}
            />
            <NewHabitForm />
          </div>

          {selectedHabit && (
            <HabitDetailPanel
              habit={selectedHabit}
              logs={allLogs.filter((log) => log.habit_id === selectedHabit.id)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function HabitWeekStrip({ habits, logs }: { habits: Habit[]; logs: HabitLog[] }) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }).map((_, i) => addDays(today, i - 3));

  return (
    <section className="pulse-pane px-4 py-4">
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const key = localDateKey(day);
          const due = habits.filter((habit) => isHabitDueOn(habit, day)).length;
          const done = habits.filter(
            (habit) => isHabitDueOn(habit, day) && isHabitLoggedOn(habit.id, day, logs)
          ).length;
          const ratio = due === 0 ? 0 : Math.round((done / due) * 100);
          const isToday = isSameDate(day, today);
          return (
            <div
              key={key}
              className={cn(
                "flex min-h-24 flex-col items-center justify-center rounded-2xl border px-2 py-3 text-center",
                isToday
                  ? "border-primary/25 bg-primary/10 text-foreground"
                  : "border-transparent bg-transparent text-muted-foreground"
              )}
            >
              <div className="text-xs font-semibold">{day.toLocaleDateString(undefined, { weekday: "short" })}</div>
              <div className="mt-1 text-lg font-semibold">{day.getDate()}</div>
              <ProgressDot ratio={ratio} color={isToday ? "#304078" : "#64748b"} muted={due === 0} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NewHabitForm() {
  const create = useCreateHabit();
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState<HabitCadence>("daily");
  const [days, setDays] = useState<number[]>([1]);
  const [color, setColor] = useState(COLORS[0]);

  async function submit() {
    const title = name.trim();
    if (!title) return;
    await create.mutateAsync({
      name: title,
      cadence,
      cadence_config: cadence === "weekly" || cadence === "custom" ? { days } : {},
      color,
    });
    setName("");
    setCadence("daily");
    setDays([1]);
    setColor(COLORS[0]);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="pulse-pane space-y-3 p-4"
    >
      <div className="flex items-center gap-2">
        <Plus className="h-4 w-4 text-muted-foreground" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New habit"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <Button type="submit" size="sm" disabled={!name.trim() || create.isPending}>
          Create
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segment value={cadence} onChange={setCadence} />
        {(cadence === "weekly" || cadence === "custom") && (
          <DayPicker days={days} onChange={setDays} />
        )}
        <div className="ml-auto flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn("h-5 w-5 rounded-full ring-2", color === c ? "ring-foreground/30" : "ring-transparent")}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      </div>
    </form>
  );
}

function HabitListPanel({
  habits,
  dueToday,
  logs,
  selectedId,
  onSelect,
}: {
  habits: Habit[];
  dueToday: Habit[];
  logs: HabitLog[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const otherHabits = habits.filter((habit) => !dueToday.some((due) => due.id === habit.id));

  return (
    <section className="pulse-pane overflow-hidden">
      <div className="border-b border-border/70 px-5 py-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Today&apos;s habits</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {dueToday.length} due today · {habits.length} total routines
            </p>
          </div>
          <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {completionCount(dueToday, logs)}/{dueToday.length}
          </div>
        </div>
      </div>

      <div className="space-y-5 px-4 py-4">
        <HabitGroup
          title="Due today"
          habits={dueToday}
          logs={logs}
          selectedId={selectedId}
          onSelect={onSelect}
          empty="No routines due today."
        />
        {otherHabits.length > 0 && (
          <HabitGroup
            title="Other routines"
            habits={otherHabits}
            logs={logs}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        )}
      </div>
    </section>
  );
}

function HabitGroup({
  title,
  habits,
  logs,
  selectedId,
  onSelect,
  empty,
}: {
  title: string;
  habits: Habit[];
  logs: HabitLog[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  empty?: string;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 px-1">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{habits.length}</span>
      </div>
      {habits.length === 0 ? (
        <p className="rounded-2xl bg-muted/40 px-4 py-5 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {habits.map((habit) => (
            <HabitListItem
              key={habit.id}
              habit={habit}
              logs={logs.filter((log) => log.habit_id === habit.id)}
              selected={selectedId === habit.id}
              onSelect={() => onSelect(habit.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function HabitListItem({
  habit,
  logs,
  selected,
  onSelect,
}: {
  habit: Habit;
  logs: HabitLog[];
  selected: boolean;
  onSelect: () => void;
}) {
  const toggle = useToggleHabitLog();
  const todayDone = completionMap(logs).has(localDateKey(new Date()));
  const color = habit.color || "#10b981";
  const Icon = habitIcon(habit);
  const streak = currentStreak(habit, logs);

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-3 rounded-2xl border bg-card px-3 py-3 transition-all",
          selected
            ? "border-primary/45 shadow-[0_14px_34px_rgba(20,24,45,0.08)]"
            : "border-border/70 hover:border-primary/25 hover:bg-muted/25"
        )}
      >
        <button
          type="button"
          onClick={() => toggle.mutate({ habitId: habit.id })}
          disabled={toggle.isPending}
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-colors",
            todayDone ? "border-transparent text-white" : "border-transparent text-white"
          )}
          style={{
            background: todayDone
              ? color
              : `linear-gradient(135deg, ${color}, ${mixWithWhite(color, 0.28)})`,
          }}
          aria-label={todayDone ? `Unlog ${habit.name}` : `Log ${habit.name}`}
        >
          {todayDone ? <Check className="h-4 w-4" /> : <Icon className="h-5 w-5" />}
        </button>

        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="truncate text-base font-semibold text-foreground">{habit.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="capitalize">{cadenceLabel(habit)}</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
            <span>{streak} day streak</span>
          </div>
        </button>

        <ChevronRight
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            selected ? "translate-x-0 opacity-100" : "opacity-40 group-hover:translate-x-0.5"
          )}
        />
      </div>
    </li>
  );
}

function Segment({
  value,
  onChange,
}: {
  value: HabitCadence;
  onChange: (value: HabitCadence) => void;
}) {
  const options: HabitCadence[] = ["daily", "weekdays", "weekly", "custom"];
  return (
    <div className="flex rounded-md border border-border p-0.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            "rounded px-2.5 py-1 text-xs capitalize transition-colors",
            value === option ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function DayPicker({ days, onChange }: { days: number[]; onChange: (days: number[]) => void }) {
  function toggle(day: number) {
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    onChange(next.length > 0 ? next : [day]);
  }
  return (
    <div className="flex items-center gap-1">
      {WEEKDAYS.map(({ day, label }) => (
        <button
          key={`${day}-${label}`}
          type="button"
          onClick={() => toggle(day)}
          className={cn(
            "grid h-7 w-7 place-items-center rounded-full text-xs transition-colors",
            days.includes(day) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function HabitDetailPanel({ habit, logs }: { habit: Habit; logs: HabitLog[] }) {
  const update = useUpdateHabit();
  const archive = useArchiveHabit();
  const toggle = useToggleHabitLog();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(habit.name);
  const todayDone = completionMap(logs).has(localDateKey(new Date()));
  const color = habit.color || "#10b981";
  const Icon = habitIcon(habit);
  const stats = useMemo(
    () => ({
      current: currentStreak(habit, logs),
      longest: longestStreak(habit, logs),
      rate: monthCompletionRate(habit, logs),
    }),
    [habit, logs]
  );

  function commitName() {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== habit.name) update.mutate({ id: habit.id, patch: { name: next } });
  }

  return (
    <article className="pulse-pane sticky top-6 overflow-hidden">
      <div className="flex items-center gap-4 border-b border-border/70 px-6 py-5">
        <div
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-white shadow-[0_14px_28px_rgba(20,24,45,0.14)]"
          style={{
            background: `linear-gradient(135deg, ${color}, ${mixWithWhite(color, 0.25)})`,
          }}
        >
          <Icon className="h-8 w-8" />
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") {
                  setDraft(habit.name);
                  setEditing(false);
                }
              }}
              className="w-full bg-transparent font-display text-2xl font-semibold outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="block truncate font-display text-2xl font-semibold"
            >
              {habit.name}
            </button>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs capitalize text-muted-foreground">
            <span>{cadenceLabel(habit)}</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
            <span>Target {habit.target_per_period}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => toggle.mutate({ habitId: habit.id })}
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-full border transition-colors",
            todayDone ? "border-transparent text-white" : "border-muted bg-muted/70 text-transparent"
          )}
          style={todayDone ? { backgroundColor: color } : undefined}
          aria-label={todayDone ? `Unlog ${habit.name}` : `Log ${habit.name}`}
        >
          {todayDone && <Check className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => archive.mutate(habit.id)}
          className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Archive habit"
        >
          <Archive className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
          <ProgressRing value={stats.rate} color={color} />
          <div className="grid grid-cols-3 gap-2">
            <Stat icon={<Flame className="h-3.5 w-3.5" />} label="Current" value={`${stats.current}`} />
            <Stat icon={<Target className="h-3.5 w-3.5" />} label="Longest" value={`${stats.longest}`} />
            <Stat icon={<Repeat className="h-3.5 w-3.5" />} label="Month" value={`${stats.rate}%`} />
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Last 90 days
            </h3>
            <span className="text-xs font-medium text-muted-foreground">{stats.rate}% this month</span>
          </div>
          <Heatmap habit={habit} logs={logs} />
        </div>
      </div>
    </article>
  );
}

function ProgressDot({ ratio, color, muted }: { ratio: number; color: string; muted: boolean }) {
  return (
    <div
      className="mt-3 grid h-10 w-10 place-items-center rounded-full"
      style={{
        background: muted
          ? "hsl(var(--muted))"
          : `conic-gradient(${color} ${ratio}%, hsl(var(--muted)) 0)`,
      }}
    >
      <div className="h-7 w-7 rounded-full bg-card" />
    </div>
  );
}

function ProgressRing({ value, color }: { value: number; color: string }) {
  return (
    <div
      className="grid h-20 w-20 shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(${color} ${value}%, hsl(var(--muted)) 0)` }}
    >
      <div className="grid h-14 w-14 place-items-center rounded-full bg-card text-xs font-semibold">
        {value}%
      </div>
    </div>
  );
}

function Heatmap({ habit, logs }: { habit: Habit; logs: HabitLog[] }) {
  const today = startOfDay(new Date());
  const done = completionMap(logs);
  const days = Array.from({ length: 90 }).map((_, i) => addDays(today, i - 89));
  return (
    <div className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-1">
      {days.map((day) => {
        const key = localDateKey(day);
        const due = isHabitDueOn(habit, day);
        const complete = (done.get(key) ?? 0) > 0;
        return (
          <div
            key={key}
            title={`${key}${complete ? " logged" : ""}`}
            className={cn(
              "aspect-square rounded-[3px]",
              !due && "bg-transparent",
              due && !complete && "bg-muted",
              complete && "bg-emerald-500"
            )}
            style={complete && habit.color ? { backgroundColor: habit.color } : undefined}
          />
        );
      })}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/40 px-3 py-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-semibold">{value}</div>
    </div>
  );
}

function completionCount(habits: Habit[], logs: HabitLog[]) {
  const today = new Date();
  return habits.filter((habit) => isHabitDueOn(habit, today) && isHabitLoggedOn(habit.id, today, logs)).length;
}

function isHabitLoggedOn(habitId: string, date: Date, logs: HabitLog[]) {
  const key = localDateKey(date);
  return logs.some((log) => log.habit_id === habitId && log.logged_on === key && !log.deleted_at);
}

function habitIcon(habit: Habit) {
  const name = `${habit.icon ?? ""} ${habit.name}`.toLowerCase();
  if (name.includes("med") || name.includes("pill")) return Pill;
  if (name.includes("exercise") || name.includes("workout") || name.includes("gym")) return Dumbbell;
  if (name.includes("journal") || name.includes("read")) return BookOpen;
  if (name.includes("sleep") || name.includes("night")) return Moon;
  if (name.includes("morning") || name.includes("rise")) return Sun;
  if (name.includes("health") || name.includes("heart")) return HeartPulse;
  if (name.includes("plan") || name.includes("calendar")) return CalendarCheck;
  if (name.includes("mood") || name.includes("smile")) return Smile;
  if (name.includes("meditate") || name.includes("mind")) return Sparkles;
  return Sprout;
}

function isSameDate(a: Date, b: Date) {
  return localDateKey(a) === localDateKey(b);
}

function mixWithWhite(hex: string, amount: number) {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const n = Number.parseInt(raw, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function cadenceLabel(habit: Habit) {
  if (habit.cadence === "weekly" || habit.cadence === "custom") {
    const days = readDaysConfig(habit);
    if (days.length > 0) {
      const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return days.map((d) => names[d]).join(", ");
    }
  }
  return habit.cadence;
}
