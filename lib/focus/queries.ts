"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { startOfDay, addDays } from "@/lib/date";
import type { Task } from "@/lib/tasks/types";
import type { FocusSession, FocusSessionInsert, FocusSessionUpdate } from "./types";

const supabase = () => createClient();

export const focusKeys = {
  all: ["focus_sessions"] as const,
  recent: () => [...focusKeys.all, "recent"] as const,
  last7Days: () => [...focusKeys.all, "last7Days"] as const,
};

export function useFocusableTasks() {
  return useQuery({
    queryKey: ["tasks", "focusable"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .is("completed_at", null)
        .order("priority", { ascending: false })
        .order("start_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

export function useRecentFocusSessions() {
  return useQuery({
    queryKey: focusKeys.recent(),
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("focus_sessions")
        .select("*")
        .is("deleted_at", null)
        .order("started_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as FocusSession[];
    },
  });
}

export function useLast7FocusSessions() {
  return useQuery({
    queryKey: focusKeys.last7Days(),
    queryFn: async () => {
      const start = startOfDay(addDays(new Date(), -6)).toISOString();
      const { data, error } = await supabase()
        .from("focus_sessions")
        .select("*")
        .is("deleted_at", null)
        .gte("started_at", start)
        .order("started_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FocusSession[];
    },
  });
}

export function useCreateFocusSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FocusSessionInsert) => {
      const { data, error } = await supabase()
        .from("focus_sessions")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as FocusSession;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: focusKeys.all }),
  });
}

export function useUpdateFocusSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: FocusSessionUpdate }) => {
      const { data, error } = await supabase()
        .from("focus_sessions")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as FocusSession;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: focusKeys.all }),
  });
}

export function useDeleteFocusSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase()
        .from("focus_sessions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: focusKeys.all }),
  });
}
