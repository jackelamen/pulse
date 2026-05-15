"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { displayNameForUser } from "./display";

export interface UserProfile {
  email: string | null;
  firstName: string;
  lastName: string;
  displayName: string | null;
}

export const profileKeys = {
  current: ["profile", "current"] as const,
};

export function useUserProfile() {
  return useQuery({
    queryKey: profileKeys.current,
    queryFn: async (): Promise<UserProfile> => {
      const { data, error } = await createClient().auth.getUser();
      if (error) throw error;
      const user = data.user;
      const metadata = user?.user_metadata ?? {};
      return {
        email: user?.email ?? null,
        firstName: stringValue(metadata.first_name),
        lastName: stringValue(metadata.last_name),
        displayName: displayNameForUser(user),
      };
    },
  });
}

export function useUpdateUserProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ firstName, lastName }: { firstName: string; lastName: string }) => {
      const cleanFirst = firstName.trim();
      const cleanLast = lastName.trim();
      const fullName = [cleanFirst, cleanLast].filter(Boolean).join(" ");
      const { data, error } = await createClient().auth.updateUser({
        data: {
          first_name: cleanFirst,
          last_name: cleanLast,
          full_name: fullName,
          name: fullName,
        },
      });
      if (error) throw error;
      return data.user;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileKeys.current });
    },
  });
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}
