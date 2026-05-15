"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { addDays, startOfDay } from "@/lib/date";
import type { Habit, HabitInsert, HabitLog, HabitUpdate } from "./types";
import { localDateKey } from "./dates";

const supabase = () => createClient();

export const habitKeys = {
  all: ["habits"] as const,
  logs: (start: string, end: string) => ["habit_logs", start, end] as const,
  todayLogs: () => ["habit_logs", "today"] as const,
};

export function useHabits() {
  return useQuery({
    queryKey: habitKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("habits")
        .select("*")
        .is("deleted_at", null)
        .is("archived_at", null)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Habit[];
    },
  });
}

export function useHabitLogsWindow(start: Date, end: Date) {
  const startKey = localDateKey(start);
  const endKey = localDateKey(end);
  return useQuery({
    queryKey: habitKeys.logs(startKey, endKey),
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("habit_logs")
        .select("*")
        .is("deleted_at", null)
        .gte("logged_on", startKey)
        .lte("logged_on", endKey)
        .order("logged_on", { ascending: true });
      if (error) throw error;
      return (data ?? []) as HabitLog[];
    },
  });
}

export function useTodayHabitLogs() {
  const today = localDateKey(new Date());
  return useQuery({
    queryKey: habitKeys.todayLogs(),
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("habit_logs")
        .select("*")
        .is("deleted_at", null)
        .eq("logged_on", today);
      if (error) throw error;
      return (data ?? []) as HabitLog[];
    },
  });
}

export function useCreateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: HabitInsert) => {
      const { data, error } = await supabase().from("habits").insert(input).select().single();
      if (error) throw error;
      return data as Habit;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: habitKeys.all }),
  });
}

export function useUpdateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: HabitUpdate }) => {
      const { data, error } = await supabase()
        .from("habits")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Habit;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: habitKeys.all }),
  });
}

export function useArchiveHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase()
        .from("habits")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: habitKeys.all }),
  });
}

export function useToggleHabitLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ habitId, date = new Date() }: { habitId: string; date?: Date }) => {
      const loggedOn = localDateKey(date);
      const { data: existing, error: findError } = await supabase()
        .from("habit_logs")
        .select("*")
        .eq("habit_id", habitId)
        .eq("logged_on", loggedOn)
        .is("deleted_at", null)
        .maybeSingle();
      if (findError) throw findError;

      const existingLog = existing as HabitLog | null;
      if (existingLog) {
        const { error } = await supabase().from("habit_logs").delete().eq("id", existingLog.id);
        if (error) throw error;
        return { logged: false, habitId, loggedOn };
      }

      const { data, error } = await supabase()
        .from("habit_logs")
        .insert({ habit_id: habitId, logged_on: loggedOn, count: 1 })
        .select()
        .single();
      if (error) throw error;
      return { logged: true, habitId, loggedOn, log: data as HabitLog };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habit_logs"] });
      qc.invalidateQueries({ queryKey: habitKeys.all });
    },
  });
}

export function useDeleteHabitLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase()
        .from("habit_logs")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habit_logs"] });
      qc.invalidateQueries({ queryKey: habitKeys.all });
    },
  });
}

export function useLast90HabitLogs() {
  const end = startOfDay(new Date());
  const start = addDays(end, -89);
  return useHabitLogsWindow(start, end);
}
