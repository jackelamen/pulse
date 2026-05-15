"use client";

import { useEffect } from "react";
import { useUserSettings } from "@/lib/settings/queries";
import { SIDEBAR_THEMES, sidebarThemeValue } from "@/lib/settings/sidebar-themes";

const ACCENTS: Record<string, string> = {
  coral: "16 85% 56%",
  blue: "214 82% 54%",
  green: "152 58% 40%",
  gold: "42 92% 48%",
  rose: "345 78% 56%",
};

export function SettingsRuntime() {
  const settings = useUserSettings();
  const data = settings.data;

  useEffect(() => {
    if (!data) return;

    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = data.theme === "dark" || (data.theme === "auto" && prefersDark);
    const accent = ACCENTS[data.accent] ?? ACCENTS.coral;
    const sidebarTheme = SIDEBAR_THEMES[sidebarThemeValue(data.sidebar_theme)];

    root.classList.toggle("dark", dark);
    root.classList.toggle("pulse-density-compact", data.density === "compact");
    root.style.setProperty("--primary", accent);
    root.style.setProperty("--ring", accent);
    root.style.setProperty("--pulse-sidebar-rail", sidebarTheme.rail);
  }, [data]);

  return null;
}
