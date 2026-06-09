"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const supabase = () => createClient();

export const googleKeys = {
  account: ["google_account"] as const,
  calendars: ["google_calendars"] as const,
};

export type GoogleCalendar = {
  id: string;
  summary: string;
  primary: boolean;
};

export type GoogleAccountStatus = {
  connected: boolean;
  email: string | null;
  syncEnabled: boolean;
  targetCalendarId: string;
  lastError: string | null;
};

/**
 * Reads the current user's google_accounts row. Returns a normalized status
 * object. We never select the refresh_token client-side (it stays server-only),
 * so this only pulls display/control fields.
 */
export function useGoogleAccount() {
  return useQuery<GoogleAccountStatus>({
    queryKey: googleKeys.account,
    queryFn: async () => {
      const { data: userData, error: userError } = await supabase().auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");

      const { data, error } = await supabase()
        .from("google_accounts")
        .select("google_email, sync_enabled, target_calendar_id, last_error")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;

      if (!data) {
        return {
          connected: false,
          email: null,
          syncEnabled: false,
          targetCalendarId: "primary",
          lastError: null,
        };
      }

      const row = data as {
        google_email: string | null;
        sync_enabled: boolean;
        target_calendar_id: string;
        last_error: string | null;
      };
      return {
        connected: true,
        email: row.google_email,
        syncEnabled: row.sync_enabled,
        targetCalendarId: row.target_calendar_id,
        lastError: row.last_error,
      };
    },
  });
}

/** Toggle sync on/off without disconnecting (keeps the stored token). */
export function useSetGoogleSyncEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data: userData } = await supabase().auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase()
        .from("google_accounts")
        .update({ sync_enabled: enabled })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: googleKeys.account }),
  });
}

/**
 * Disconnect: delete the google_accounts row (drops the refresh token). This
 * leaves any already-created Google events in place; it just stops future sync.
 */
export function useDisconnectGoogle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase().auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase()
        .from("google_accounts")
        .delete()
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: googleKeys.account }),
  });
}

/** "Sync now" — kick the server route that invokes the push-to-google function. */
export function useSyncGoogleNow() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/google/sync", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Sync failed");
      }
      return res.json() as Promise<{ ok: boolean; result?: unknown }>;
    },
  });
}

/** List the user's writable Google calendars for the picker. */
export function useGoogleCalendars(enabled: boolean) {
  return useQuery<GoogleCalendar[]>({
    queryKey: googleKeys.calendars,
    enabled,
    queryFn: async () => {
      const res = await fetch("/api/google/calendars");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not list calendars");
      }
      const data = (await res.json()) as { calendars: GoogleCalendar[] };
      return data.calendars;
    },
    staleTime: 5 * 60_000,
  });
}

/** Save which calendar tasks should sync to. */
export function useSetTargetCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (calendarId: string) => {
      const { data: userData } = await supabase().auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase()
        .from("google_accounts")
        .update({ target_calendar_id: calendarId })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: googleKeys.account }),
  });
}
