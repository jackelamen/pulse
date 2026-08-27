export const SIDEBAR_THEMES = {
  // Default navy — the most readable, used as the baseline
  midnight: {
    label: "Midnight",
    rail: "linear-gradient(180deg, #1a2550 0%, #253568 48%, #303b7a 100%)",
    hero: "linear-gradient(135deg, #16203f 0%, #253568 100%)",
    heroDark: "linear-gradient(135deg, #111834 0%, #1d2a55 100%)",
    preview: "bg-[linear-gradient(135deg,#1a2550,#303b7a)]",
  },
  // Purple/indigo — requested
  indigo: {
    label: "Indigo",
    rail: "linear-gradient(180deg, #1e1152 0%, #3730a3 48%, #4f46e5 100%)",
    hero: "linear-gradient(135deg, #1a0f47 0%, #3730a3 100%)",
    heroDark: "linear-gradient(135deg, #150c39 0%, #2a2680 100%)",
    preview: "bg-[linear-gradient(135deg,#1e1152,#4f46e5)]",
  },
  // Deep purple to violet
  violet: {
    label: "Violet",
    rail: "linear-gradient(180deg, #2e1065 0%, #5b21b6 48%, #7c3aed 100%)",
    hero: "linear-gradient(135deg, #260d54 0%, #5b21b6 100%)",
    heroDark: "linear-gradient(135deg, #1e0a43 0%, #451a8c 100%)",
    preview: "bg-[linear-gradient(135deg,#2e1065,#7c3aed)]",
  },
  // Dark teal — readable, calm
  ocean: {
    label: "Ocean",
    rail: "linear-gradient(180deg, #0a2540 0%, #0e4f6b 48%, #0891b2 100%)",
    hero: "linear-gradient(135deg, #08203a 0%, #0e4f6b 100%)",
    heroDark: "linear-gradient(135deg, #06182b 0%, #0b3e54 100%)",
    preview: "bg-[linear-gradient(135deg,#0a2540,#0891b2)]",
  },
  // Near-black with warm undertone — easy to read
  graphite: {
    label: "Graphite",
    rail: "linear-gradient(180deg, #111827 0%, #1e2533 52%, #2d3748 100%)",
    hero: "linear-gradient(135deg, #0e1420 0%, #1e2533 100%)",
    heroDark: "linear-gradient(135deg, #0b1018 0%, #181e29 100%)",
    preview: "bg-[linear-gradient(135deg,#111827,#2d3748)]",
  },
  // Dark forest green
  forest: {
    label: "Forest",
    rail: "linear-gradient(180deg, #052e16 0%, #14532d 48%, #166534 100%)",
    hero: "linear-gradient(135deg, #04270f 0%, #14532d 100%)",
    heroDark: "linear-gradient(135deg, #031d0c 0%, #0f3f22 100%)",
    preview: "bg-[linear-gradient(135deg,#052e16,#166534)]",
  },
} as const;

export type SidebarTheme = keyof typeof SIDEBAR_THEMES;

export const DEFAULT_SIDEBAR_THEME: SidebarTheme = "midnight";

export function sidebarThemeValue(value: unknown): SidebarTheme {
  return typeof value === "string" && value in SIDEBAR_THEMES
    ? (value as SidebarTheme)
    : DEFAULT_SIDEBAR_THEME;
}
