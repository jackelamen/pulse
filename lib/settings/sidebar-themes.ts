export const SIDEBAR_THEMES = {
  midnight: {
    label: "Midnight",
    rail: "linear-gradient(180deg, #253568 0%, #303b72 48%, #3c4a80 100%)",
    preview: "bg-[linear-gradient(135deg,#253568,#3c4a80)]",
  },
  ember: {
    label: "Ember",
    rail: "linear-gradient(180deg, #351f4c 0%, #8b2f55 48%, #f25c2a 100%)",
    preview: "bg-[linear-gradient(135deg,#351f4c,#f25c2a)]",
  },
  aurora: {
    label: "Aurora",
    rail: "linear-gradient(180deg, #102f4c 0%, #0f766e 48%, #5eead4 100%)",
    preview: "bg-[linear-gradient(135deg,#102f4c,#5eead4)]",
  },
  plum: {
    label: "Plum",
    rail: "linear-gradient(180deg, #2e1065 0%, #6d28d9 48%, #db2777 100%)",
    preview: "bg-[linear-gradient(135deg,#2e1065,#db2777)]",
  },
  graphite: {
    label: "Graphite",
    rail: "linear-gradient(180deg, #111827 0%, #334155 52%, #64748b 100%)",
    preview: "bg-[linear-gradient(135deg,#111827,#64748b)]",
  },
} as const;

export type SidebarTheme = keyof typeof SIDEBAR_THEMES;

export const DEFAULT_SIDEBAR_THEME: SidebarTheme = "midnight";

export function sidebarThemeValue(value: unknown): SidebarTheme {
  return typeof value === "string" && value in SIDEBAR_THEMES
    ? (value as SidebarTheme)
    : DEFAULT_SIDEBAR_THEME;
}
