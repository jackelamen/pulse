"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { DEFAULT_SIDEBAR_THEME } from "./sidebar-themes";

export type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"];
export type UserSettingsUpdate = Database["public"]["Tables"]["user_settings"]["Update"];

const supabase = () => createClient();

export const settingsKeys = {
  all: ["user_settings"] as const,
};

const DEFAULT_SETTINGS: Omit<UserSettings, "user_id" | "updated_at"> = {
  theme: "auto",
  accent: "coral",
  sidebar_theme: DEFAULT_SIDEBAR_THEME,
  density: "comfortable",
  week_starts_on: 1,
  work_hours_start: "09:00:00",
  work_hours_end: "18:00:00",
  pomodoro_focus_minutes: 25,
  pomodoro_break_minutes: 5,
  pomodoro_strict_mode: false,
  default_view: "/today",
};

export function useUserSettings() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: async () => {
      const { data: userData, error: userError } = await supabase().auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");

      const { data, error } = await supabase()
        .from("user_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as UserSettings;

      const { data: created, error: createError } = await supabase()
        .from("user_settings")
        .insert({ user_id: userId, ...DEFAULT_SETTINGS })
        .select()
        .single();
      if (createError) throw createError;
      return created as UserSettings;
    },
  });
}

export function useUpdateUserSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: UserSettingsUpdate) => {
      const { data: userData, error: userError } = await supabase().auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");

      const { data, error } = await supabase()
        .from("user_settings")
        .update(patch)
        .eq("user_id", userId)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (data) return data as UserSettings;

      const { data: created, error: createError } = await supabase()
        .from("user_settings")
        .insert({ user_id: userId, ...DEFAULT_SETTINGS, ...patch })
        .select()
        .single();
      if (createError) throw createError;
      return created as UserSettings;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}
