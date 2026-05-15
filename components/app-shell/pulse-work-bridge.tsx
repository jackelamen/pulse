"use client";

import { useEffect } from "react";
import { localDateKey } from "@/lib/habits/dates";
import { isHabitDueOn } from "@/lib/habits/dates";
import { useHabits, useTodayHabitLogs } from "@/lib/habits/queries";
import { useLast7FocusSessions } from "@/lib/focus/queries";
import { useCompletedTodayTasks, useLeftoverTasks, useTodayTasks } from "@/lib/tasks/queries";
import type { Task } from "@/lib/tasks/types";

const WORK_BRIDGE_KEY = "edgex_pulse_timeblocks_v1";
const DASHBOARD_BRIDGE_KEY = "edgex_pulse_dashboard_v1";

function localTimeLabel(iso: string) {
  const d = new Date(iso);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function readableTimeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function toBridgeTask(task: Task) {
  return {
    id: task.id,
    title: task.title,
    start_at: task.start_at,
    start: task.start_at ? localTimeLabel(task.start_at) : null,
    duration_minutes: task.duration_minutes,
    priority: task.priority,
    tags: task.tags ?? [],
    list_id: task.list_id,
  };
}

function taskTimeValue(task: Task) {
  return new Date(task.start_at ?? task.due_at ?? task.created_at).getTime();
}

export function PulseWorkBridge() {
  const today = useTodayTasks();
  const completedToday = useCompletedTodayTasks();
  const leftovers = useLeftoverTasks();
  const habits = useHabits();
  const habitLogs = useTodayHabitLogs();
  const focusSessions = useLast7FocusSessions();

  useEffect(() => {
    if (typeof window === "undefined" || !today.data) return;

    const date = localDateKey(new Date());
    const payload = {
      version: 1,
      source: "pulse",
      date,
      exported_at: new Date().toISOString(),
      tasks: today.data
        .filter((task) => task.start_at && !task.completed_at)
        .map(toBridgeTask)
        .sort((a, b) => String(a.start_at).localeCompare(String(b.start_at))),
    };

    window.localStorage.setItem(WORK_BRIDGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("edgex:pulse-timeblocks-updated", { detail: payload }));
  }, [today.data]);

  useEffect(() => {
    if (typeof window === "undefined" || !today.data) return;

    const now = new Date();
    const date = localDateKey(now);
    const openTasks = today.data ?? [];
    const topTasks = [...openTasks]
      .sort((a, b) => b.priority - a.priority || taskTimeValue(a) - taskTimeValue(b))
      .slice(0, 3)
      .map((task) => ({
        id: task.id,
        title: task.title,
        priority: task.priority,
        start: task.start_at ? readableTimeLabel(task.start_at) : null,
      }));
    const timedTasks = openTasks
      .filter((task) => task.start_at)
      .sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));
    const nextTimed =
      timedTasks.find((task) => new Date(task.start_at!).getTime() >= now.getTime()) ??
      timedTasks[0] ??
      null;
    const dueHabits = (habits.data ?? []).filter((habit) => isHabitDueOn(habit, now));
    const loggedHabitIds = new Set((habitLogs.data ?? []).map((log) => log.habit_id));
    const focusMinutesToday = (focusSessions.data ?? [])
      .filter((session) => localDateKey(new Date(session.started_at)) === date)
      .reduce((sum, session) => sum + (session.actual_minutes ?? session.planned_minutes ?? 0), 0);

    const payload = {
      version: 1,
      source: "pulse",
      date,
      updatedAt: new Date().toISOString(),
      topTasks,
      overdueCount: (leftovers.data ?? []).length,
      nextTimedTask: nextTimed
        ? {
            id: nextTimed.id,
            title: nextTimed.title,
            start: nextTimed.start_at ? readableTimeLabel(nextTimed.start_at) : null,
            duration_minutes: nextTimed.duration_minutes,
          }
        : null,
      habitsRemaining: dueHabits.filter((habit) => !loggedHabitIds.has(habit.id)).length,
      focusMinutesToday,
      completedToday: (completedToday.data ?? []).length,
    };

    window.localStorage.setItem(DASHBOARD_BRIDGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("edgex:pulse-dashboard-updated", { detail: payload }));
  }, [
    completedToday.data,
    focusSessions.data,
    habitLogs.data,
    habits.data,
    leftovers.data,
    today.data,
  ]);

  return null;
}
