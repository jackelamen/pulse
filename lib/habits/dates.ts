import { addDays, startOfDay } from "@/lib/date";
import type { Habit, HabitLog } from "./types";

export function localDateKey(d: Date): string {
  const x = startOfDay(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isHabitDueOn(habit: Habit, date: Date): boolean {
  if (habit.archived_at || habit.deleted_at) return false;
  const day = date.getDay();
  if (habit.cadence === "daily") return true;
  if (habit.cadence === "weekdays") return day >= 1 && day <= 5;
  if (habit.cadence === "weekly") {
    const config = readDaysConfig(habit);
    return config.length > 0 ? config.includes(day) : day === 1;
  }
  if (habit.cadence === "custom") {
    const config = readDaysConfig(habit);
    return config.length > 0 ? config.includes(day) : true;
  }
  return true;
}

export function readDaysConfig(habit: Habit): number[] {
  const value = habit.cadence_config;
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const days = value.days;
  if (!Array.isArray(days)) return [];
  return days.filter((d): d is number => typeof d === "number" && d >= 0 && d <= 6);
}

export function completionMap(logs: HabitLog[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const log of logs) {
    if (log.deleted_at) continue;
    map.set(log.logged_on, (map.get(log.logged_on) ?? 0) + log.count);
  }
  return map;
}

export function currentStreak(habit: Habit, logs: HabitLog[], today = new Date()): number {
  const done = completionMap(logs);
  let streak = 0;
  let cursor = startOfDay(today);
  for (let i = 0; i < 365; i++) {
    if (!isHabitDueOn(habit, cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if ((done.get(localDateKey(cursor)) ?? 0) <= 0) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function longestStreak(habit: Habit, logs: HabitLog[], end = new Date(), days = 90): number {
  const done = completionMap(logs);
  let best = 0;
  let run = 0;
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(startOfDay(end), -i);
    if (!isHabitDueOn(habit, d)) continue;
    if ((done.get(localDateKey(d)) ?? 0) > 0) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

export function monthCompletionRate(habit: Habit, logs: HabitLog[], today = new Date()): number {
  const done = completionMap(logs);
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  let due = 0;
  let complete = 0;
  for (let d = startOfDay(start); d <= startOfDay(today); d = addDays(d, 1)) {
    if (!isHabitDueOn(habit, d)) continue;
    due += 1;
    if ((done.get(localDateKey(d)) ?? 0) > 0) complete += 1;
  }
  return due === 0 ? 0 : Math.round((complete / due) * 100);
}
