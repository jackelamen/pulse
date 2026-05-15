import type { User } from "@supabase/supabase-js";

type UserMetadata = Record<string, unknown>;

export function displayNameForUser(user: Pick<User, "email" | "user_metadata"> | null) {
  if (!user) return null;
  const metadata = (user.user_metadata ?? {}) as UserMetadata;
  const metadataName = firstString(
    metadata.full_name,
    metadata.name,
    metadata.display_name,
    metadata.preferred_username,
    metadata.user_name
  );
  if (metadataName) return titleCase(cleanName(metadataName));

  const emailName = user.email?.split("@")[0];
  if (!emailName) return null;
  return titleCase(cleanName(emailName));
}

export function initialsForName(name: string | null, fallback = "P") {
  if (!name) return fallback;
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function cleanName(value: string) {
  return value
    .replace(/[._-]+/g, " ")
    .replace(/\+.*$/g, "")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
