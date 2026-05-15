/**
 * Deterministic fallback color for tags that haven't been explicitly themed.
 * Hashing the tag name keeps the same tag the same color across renders/sessions
 * without needing a DB write up front.
 */
const PALETTE = [
  "#f25c2a", "#10b981", "#3b82f6", "#8b5cf6",
  "#f59e0b", "#ec4899", "#06b6d4", "#84cc16",
];

export function tagColor(name: string, explicit?: string | null): string {
  if (explicit) return explicit;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}
