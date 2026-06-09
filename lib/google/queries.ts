"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const supabase = () => createClient();

export const googleKeys = {
  account: ["google_account"] as const,
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
