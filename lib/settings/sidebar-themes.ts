/**
 * Sidebar themes.
 *
 * The sidebar is chrome: its job is to hold the nav and recede, never to
 * compete with the content beside it. Every theme therefore shares one
 * envelope, measured off Midnight -- lightness 21/28/33% across the three
 * stops (a 12-point range) at roughly 51/48/44% saturation -- and hue is the
 * only variable between them.
 *
 * This replaced six independently-chosen gradients that ramped from near-black
 * into a bright, high-chroma endpoint: Indigo spanned 40 lightness points up to
 * L=59%, Violet 35, and Ocean reached 91% saturation. At those values the
 * navigation glowed brighter than the tasks it framed and read as garish
 * rather than quiet. Keep new themes inside the envelope; if a hue needs to
 * look right at a different lightness, move the hue, not the range.
 *
 * Green and cyan read lighter than blue at equal lightness, so Ocean and
 * Forest sit two points lower to match perceived weight.
 *
 * White is the text colour on these surfaces; every theme keeps it at 6.7:1 or
 * better against its lightest stop.
 *
 * `hero` and `heroDark` are the matching content-panel surfaces on Today,
 * applied by SettingsRuntime. They sit in the darker half of the same ramp so a
 * panel anchors rather than glows, and never introduce a hue of their own.
 *
 * Preview strings must stay literal -- Tailwind scans this file for them.
 */
export const SIDEBAR_THEMES = {
  /** Default. Its measured envelope is the spec every other theme follows. */
  midnight: {
    label: "Midnight",
    rail: "linear-gradient(180deg, #1a2550 0%, #253568 48%, #303b7a 100%)",
    hero: "linear-gradient(135deg, #151e41 0%, #25356a 100%)",
    heroDark: "linear-gradient(135deg, #111936 0%, #1e2c57 100%)",
    preview: "bg-[linear-gradient(135deg,#1a2550,#303b7a)]",
  },
  /** Blue-violet, one clear step off Midnight. */
  indigo: {
    label: "Indigo",
    rail: "linear-gradient(180deg, #271a51 0%, #34256a 48%, #442f79 100%)",
    hero: "linear-gradient(135deg, #1f1542 0%, #34256a 100%)",
    heroDark: "linear-gradient(135deg, #1a1136 0%, #2b1e57 100%)",
    preview: "bg-[linear-gradient(135deg,#271a51,#442f79)]",
  },
  /** Plum. Pushed toward magenta so it reads distinctly from Indigo. */
  violet: {
    label: "Violet",
    rail: "linear-gradient(180deg, #451b50 0%, #592768 48%, #6d3177 100%)",
    hero: "linear-gradient(135deg, #381641 0%, #592768 100%)",
    heroDark: "linear-gradient(135deg, #2e1236 0%, #492056 100%)",
    preview: "bg-[linear-gradient(135deg,#451b50,#6d3177)]",
  },
  /** Deep teal. Hue shifts cyan-ward as it lightens. Two lightness points lower for perceptual weight. */
  ocean: {
    label: "Ocean",
    rail: "linear-gradient(180deg, #17374a 0%, #225063 48%, #2b6373 100%)",
    hero: "linear-gradient(135deg, #122c3a 0%, #225063 100%)",
    heroDark: "linear-gradient(135deg, #0f232f 0%, #1b4150 100%)",
    preview: "bg-[linear-gradient(135deg,#17374a,#2b6373)]",
  },
  /** Near-neutral slate for anyone who wants no hue at all. */
  graphite: {
    label: "Graphite",
    rail: "linear-gradient(180deg, #272b35 0%, #353a46 48%, #414853 100%)",
    hero: "linear-gradient(135deg, #1e2229 0%, #353a46 100%)",
    heroDark: "linear-gradient(135deg, #181b21 0%, #2a2e37 100%)",
    preview: "bg-[linear-gradient(135deg,#272b35,#414853)]",
  },
  /** Muted deep green. Two lightness points lower for perceptual weight. */
  forest: {
    label: "Forest",
    rail: "linear-gradient(180deg, #1b4134 0%, #255543 48%, #30644d 100%)",
    hero: "linear-gradient(135deg, #153329 0%, #255543 100%)",
    heroDark: "linear-gradient(135deg, #102820 0%, #1e4335 100%)",
    preview: "bg-[linear-gradient(135deg,#1b4134,#30644d)]",
  },
} as const;

export type SidebarTheme = keyof typeof SIDEBAR_THEMES;

export const DEFAULT_SIDEBAR_THEME: SidebarTheme = "midnight";

export function sidebarThemeValue(value: unknown): SidebarTheme {
  return typeof value === "string" && value in SIDEBAR_THEMES
    ? (value as SidebarTheme)
    : DEFAULT_SIDEBAR_THEME;
}
