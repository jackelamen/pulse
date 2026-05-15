"use client";

import { Download, Keyboard, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useUpdateUserProfile, useUserProfile } from "@/lib/profile/queries";
import { useUpdateUserSettings, useUserSettings } from "@/lib/settings/queries";
import { SIDEBAR_THEMES, sidebarThemeValue } from "@/lib/settings/sidebar-themes";
import { useUi } from "@/lib/ui/store";
import { cn } from "@/lib/utils";

const ACCENTS = [
  { value: "coral", label: "Coral", color: "bg-[#ea6841]" },
  { value: "blue", label: "Blue", color: "bg-[#2f7fe4]" },
  { value: "green", label: "Green", color: "bg-[#2b9b6b]" },
  { value: "gold", label: "Gold", color: "bg-[#eba80d]" },
  { value: "rose", label: "Rose", color: "bg-[#e24371]" },
] as const;

export function SettingsClient() {
  const settings = useUserSettings();
  const profile = useUserProfile();
  const update = useUpdateUserSettings();
  const updateProfile = useUpdateUserProfile();
  const setShortcutsOpen = useUi((s) => s.setShortcutsOpen);
  const [exporting, setExporting] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const data = settings.data;
  const savedAt = useMemo(
    () => (data?.updated_at ? new Date(data.updated_at).toLocaleString() : null),
    [data?.updated_at]
  );

  useEffect(() => {
    if (!profile.data) return;
    setFirstName(profile.data.firstName);
    setLastName(profile.data.lastName);
  }, [profile.data]);

  if (settings.isLoading || profile.isLoading || !data) {
    return <div className="px-1 py-6 text-sm text-muted-foreground">Loading settings...</div>;
  }

  async function exportData() {
    setExporting(true);
    try {
      const res = await fetch("/api/export", { cache: "no-store" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pulse-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="pulse-pane p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Account
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">First name</span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
              autoComplete="given-name"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Last name</span>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
              autoComplete="family-name"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            onClick={() => updateProfile.mutate({ firstName, lastName })}
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? "Saving" : "Save profile"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Signed in as {profile.data?.email ?? "unknown account"}
          </span>
        </div>
      </section>

      <section className="pulse-pane p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Appearance
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">Theme</span>
            <select
              value={data.theme}
              onChange={(e) =>
                update.mutate({ theme: e.target.value as "light" | "dark" | "auto" })
              }
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="auto">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Density</span>
            <select
              value={data.density}
              onChange={(e) =>
                update.mutate({ density: e.target.value as "comfortable" | "compact" })
              }
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </label>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-sm font-medium">Accent</div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Accent color">
            {ACCENTS.map((accent) => (
              <button
                key={accent.value}
                type="button"
                role="radio"
                aria-checked={data.accent === accent.value}
                aria-label={accent.label}
                onClick={() => update.mutate({ accent: accent.value })}
                className={cn(
                  "h-9 w-9 rounded-full border-2 border-card ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  accent.color,
                  data.accent === accent.value && "ring-2 ring-ring"
                )}
              />
            ))}
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-sm font-medium">Sidebar theme</div>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Sidebar theme">
            {Object.entries(SIDEBAR_THEMES).map(([value, theme]) => {
              const active = sidebarThemeValue(data.sidebar_theme) === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => update.mutate({ sidebar_theme: value })}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-2 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "h-8 w-12 shrink-0 rounded-lg shadow-inner",
                      theme.preview
                    )}
                  />
                  <span className="truncate">{theme.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="pulse-pane p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Calendar defaults
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium">Week starts on</span>
            <select
              value={data.week_starts_on}
              onChange={(e) => update.mutate({ week_starts_on: Number(e.target.value) })}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <option value={0}>Sunday</option>
              <option value={1}>Monday</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Work starts</span>
            <input
              type="time"
              value={data.work_hours_start.slice(0, 5)}
              onChange={(e) => update.mutate({ work_hours_start: `${e.target.value}:00` })}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Work ends</span>
            <input
              type="time"
              value={data.work_hours_end.slice(0, 5)}
              onChange={(e) => update.mutate({ work_hours_end: `${e.target.value}:00` })}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      <section className="pulse-pane p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Focus defaults
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium">Default view</span>
            <select
              value={data.default_view}
              onChange={(e) => update.mutate({ default_view: e.target.value })}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="/today">Today</option>
              <option value="/inbox">Inbox</option>
              <option value="/calendar">Calendar</option>
              <option value="/focus">Focus</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Focus minutes</span>
            <input
              type="number"
              min={1}
              max={240}
              value={data.pomodoro_focus_minutes}
              onChange={(e) =>
                update.mutate({
                  pomodoro_focus_minutes: Math.max(1, Number(e.target.value) || 1),
                })
              }
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Break minutes</span>
            <input
              type="number"
              min={1}
              max={120}
              value={data.pomodoro_break_minutes}
              onChange={(e) =>
                update.mutate({
                  pomodoro_break_minutes: Math.max(1, Number(e.target.value) || 1),
                })
              }
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-3">
          <span>
            <span className="block text-sm font-medium">Strict mode</span>
            <span className="block text-xs text-muted-foreground">
              Stop sessions automatically when the planned timer ends.
            </span>
          </span>
          <input
            type="checkbox"
            checked={data.pomodoro_strict_mode}
            onChange={(e) => update.mutate({ pomodoro_strict_mode: e.target.checked })}
            className="h-5 w-5 accent-primary"
          />
        </label>
      </section>

      <section className="pulse-pane p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Launch tools
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={exportData} disabled={exporting}>
            <Download className="h-4 w-4" />
            {exporting ? "Exporting" : "Export JSON"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setShortcutsOpen(true)}>
            <Keyboard className="h-4 w-4" />
            Keyboard shortcuts
          </Button>
        </div>
        {savedAt && <p className="mt-3 text-xs text-muted-foreground">Last saved {savedAt}</p>}
      </section>

      <section className="flex items-center justify-between gap-4">
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>

        {update.isPending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Save className="h-3.5 w-3.5" />
            Saving
          </div>
        )}
      </section>
    </div>
  );
}
