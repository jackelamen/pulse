"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  Inbox,
  Sun,
  CalendarDays,
  Calendar,
  Repeat,
  Timer,
  ArchiveRestore,
  BookOpenCheck,
  Layers,
  Search,
  Settings,
  CircleCheckBig,
  Grid2X2,
  Bell,
  HelpCircle,
  RefreshCw,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarLists } from "./sidebar-lists";
import { SidebarTags } from "./sidebar-tags";
import { useUi } from "@/lib/ui/store";
import { initialsForName } from "@/lib/profile/display";
import { PulseMark } from "./pulse-mark";

type NavItem = {
  href: Route;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
};
type NavMode = "tasks" | "calendar" | "habits" | "focus" | "settings";

const PINNED: NavItem[] = [
  { href: "/today", label: "Today", icon: Sun, shortcut: "g t" },
  { href: "/inbox", label: "Inbox", icon: Inbox, shortcut: "g i" },
  { href: "/upcoming", label: "Upcoming", icon: CalendarDays, shortcut: "g u" },
  { href: "/anytime", label: "Anytime", icon: Layers },
  { href: "/someday", label: "Someday", icon: ArchiveRestore },
  { href: "/logbook", label: "Logbook", icon: BookOpenCheck },
];

const CALENDAR_ITEMS: NavItem[] = [
  { href: "/calendar", label: "Calendar", icon: Calendar, shortcut: "g c" },
  { href: "/upcoming", label: "Upcoming", icon: CalendarDays, shortcut: "g u" },
  { href: "/today", label: "Today schedule", icon: Sun, shortcut: "g t" },
];

const HABIT_ITEMS: NavItem[] = [
  { href: "/habits", label: "Habits", icon: Repeat, shortcut: "g h" },
];

const FOCUS_ITEMS: NavItem[] = [
  { href: "/focus", label: "Focus", icon: Timer, shortcut: "g f" },
];

const SETTINGS_ITEMS: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings, shortcut: "g s" },
];

const RAIL: Array<{
  href: Route;
  mode: NavMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}> = [
  { href: "/today", mode: "tasks", label: "Tasks", icon: CircleCheckBig, tone: "from-white to-white" },
  { href: "/calendar", mode: "calendar", label: "Calendar", icon: Calendar, tone: "from-slate-300 to-slate-400" },
  { href: "/habits", mode: "habits", label: "Habits", icon: Grid2X2, tone: "from-emerald-300 to-sky-300" },
  { href: "/focus", mode: "focus", label: "Focus", icon: Timer, tone: "from-violet-300 to-fuchsia-300" },
  { href: "/settings", mode: "settings", label: "Settings", icon: Settings, tone: "from-amber-200 to-orange-300" },
];

export function SidebarNav({ email, name }: { email?: string | null; name?: string | null }) {
  const path = usePathname();
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const mode = modeForPath(path);
  const label = name || email || "Not signed in";

  return (
    <nav className="flex h-full overflow-hidden border-r border-white/10 text-white shadow-[12px_0_32px_rgba(15,16,32,0.12)]">
      <div
        className="flex w-[74px] shrink-0 flex-col items-center px-3 py-4"
        style={{ background: "var(--pulse-sidebar-rail)" }}
      >
        <div className="mb-7 grid h-12 w-12 place-items-center rounded-3xl bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_12px_26px_rgba(0,0,0,0.16)]">
          <PulseMark className="h-9 w-9" />
        </div>
        <div className="flex flex-1 flex-col items-center gap-4">
          {RAIL.map((item) => {
            const Icon = item.icon;
            const active = mode === item.mode;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-2xl transition-all",
                  active
                    ? "bg-white text-[#26345f] shadow-[0_12px_24px_rgba(0,0,0,0.18)]"
                    : "text-white/52 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    !active && `bg-gradient-to-br ${item.tone} bg-clip-text`
                  )}
                />
              </Link>
            );
          })}
        </div>
        <div className="flex flex-col items-center gap-4 text-white/45">
          <button
            type="button"
            aria-label="Sync"
            title="Sync"
            className="grid h-10 w-10 place-items-center rounded-2xl hover:bg-white/10 hover:text-white"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Notifications"
            title="Notifications"
            className="relative grid h-10 w-10 place-items-center rounded-2xl hover:bg-white/10 hover:text-white"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-[#3c4a80]" />
          </button>
          <button
            type="button"
            aria-label="Help"
            title="Help"
            className="grid h-10 w-10 place-items-center rounded-2xl hover:bg-white/10 hover:text-white"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto border-r border-border bg-secondary/70 text-foreground dark:bg-card/80">
      <div className="flex items-center gap-3 px-4 pb-4 pt-5">
        <div>
          <div className="font-display text-lg font-semibold tracking-tight text-foreground">
            {modeTitle(mode)}
          </div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Pulse</div>
        </div>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="ml-auto grid h-9 w-9 place-items-center rounded-xl bg-card text-muted-foreground shadow-[0_6px_18px_rgba(20,24,45,0.08)] hover:text-foreground dark:border dark:border-border"
          aria-label="New item"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="px-3">
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex w-full items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 text-sm text-muted-foreground shadow-[0_8px_24px_rgba(20,24,45,0.06)] transition-colors hover:text-foreground dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
          aria-label="Search and commands"
        >
          <Search className="h-4 w-4" />
          <span>Search or jump</span>
          <span className="ml-auto rounded-lg border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </span>
        </button>
      </div>

      {mode === "tasks" ? (
        <>
          <div className="mt-4 space-y-0.5 px-2">
            {PINNED.map((item) => (
              <NavLink key={item.href} item={item} active={path.startsWith(item.href)} />
            ))}
          </div>
          <div className="mt-5">
            <SidebarLists />
          </div>
          <div className="mt-5">
            <SidebarTags />
          </div>
        </>
      ) : (
        <div className="mt-4 px-2">
          <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {modeTitle(mode)}
          </div>
          <div className="space-y-0.5">
            {itemsForMode(mode).map((item) => (
              <NavLink key={item.href} item={item} active={path.startsWith(item.href)} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto border-t border-border p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-amber-300 text-[11px] font-semibold text-white shadow-[0_8px_18px_rgba(242,92,42,0.2)]">
            {initialsForName(name ?? null, email?.slice(0, 1).toUpperCase() || "P")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">{label}</div>
            {name && email && <div className="truncate text-[10px] text-muted-foreground">{email}</div>}
          </div>
          <Link
            href="/settings"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>
      </div>
    </nav>
  );
}

function modeForPath(path: string): NavMode {
  if (path.startsWith("/calendar") || path.startsWith("/upcoming")) return "calendar";
  if (path.startsWith("/habits")) return "habits";
  if (path.startsWith("/focus")) return "focus";
  if (path.startsWith("/settings")) return "settings";
  return "tasks";
}

function modeTitle(mode: NavMode) {
  if (mode === "tasks") return "Tasks";
  if (mode === "calendar") return "Calendar";
  if (mode === "habits") return "Habits";
  if (mode === "focus") return "Focus";
  return "Settings";
}

function itemsForMode(mode: NavMode) {
  if (mode === "calendar") return CALENDAR_ITEMS;
  if (mode === "habits") return HABIT_ITEMS;
  if (mode === "focus") return FOCUS_ITEMS;
  if (mode === "settings") return SETTINGS_ITEMS;
  return PINNED;
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] transition-colors",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-card hover:text-foreground"
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
      <span className="truncate">{item.label}</span>
      {item.shortcut && (
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{item.shortcut}</span>
      )}
    </Link>
  );
}
