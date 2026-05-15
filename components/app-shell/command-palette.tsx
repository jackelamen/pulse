"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Search, Hash, AtSign, Slash, Sun, CalendarDays, Inbox, Timer, Repeat, Layers, Clock3 } from "lucide-react";
import { useUi } from "@/lib/ui/store";
import { createClient } from "@/lib/supabase/client";
import { useLists } from "@/lib/lists/queries";
import { useTags } from "@/lib/lists/queries";
import { fuzzyScore } from "@/lib/ui/fuzzy";
import type { Task } from "@/lib/tasks/types";

type Item =
  | { kind: "task"; id: string; title: string; subtitle?: string }
  | { kind: "list"; id: string; name: string; color: string | null }
  | { kind: "tag"; name: string; color: string | null }
  | { kind: "command"; href?: Route; action?: () => void; label: string; icon: React.ComponentType<{ className?: string }> };

const STATIC_COMMANDS: Array<{ label: string; href: Route; icon: React.ComponentType<{ className?: string }> }> = [
  { label: "Go to Today", href: "/today", icon: Sun },
  { label: "Go to Inbox", href: "/inbox", icon: Inbox },
  { label: "Go to Upcoming", href: "/upcoming", icon: CalendarDays },
  { label: "Go to Timeline View", href: "/timeline", icon: Clock3 },
  { label: "Go to Projects", href: "/projects", icon: Layers },
  { label: "Go to Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Go to Habits", href: "/habits", icon: Repeat },
  { label: "Go to Focus", href: "/focus", icon: Timer },
];

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, openQuickAdd, openTask } = useUi();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const lists = useLists();
  const tags = useTags();

  // Cmd+K / Ctrl+K opens; "/" focuses too (when not typing)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPaletteOpen]);

  // Reset state on close
  useEffect(() => {
    if (!paletteOpen) {
      setQ("");
      setActive(0);
      setTasks([]);
    } else {
      // give the dialog a tick to mount before focusing
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [paletteOpen]);

  // Fuzzy task search (last 200 incomplete or recently completed). Server-side.
  useEffect(() => {
    if (!paletteOpen) return;
    if (q.startsWith("/") || q.startsWith("#") || q.startsWith("@")) {
      setTasks([]);
      return;
    }
    if (!q.trim()) {
      setTasks([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("tasks")
        .select("id, title, completed_at, due_at")
        .is("deleted_at", null)
        .ilike("title", `%${q}%`)
        .order("completed_at", { ascending: true, nullsFirst: true })
        .limit(20);
      if (!cancelled) setTasks((data ?? []) as Task[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [q, paletteOpen]);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const query = q.trim();

    if (query.startsWith("/")) {
      const rest = query.slice(1);
      const cmds = STATIC_COMMANDS.map((c) => ({ ...c, score: fuzzyScore(rest, c.label) }))
        .filter((c) => c.score > 0 || rest === "")
        .sort((a, b) => b.score - a.score);
      for (const c of cmds) {
        out.push({ kind: "command", label: c.label, href: c.href, icon: c.icon });
      }
      out.push({
        kind: "command",
        label: "New task (Quick add)",
        action: () => {
          setPaletteOpen(false);
          openQuickAdd();
        },
        icon: Slash,
      });
      return out;
    }

    if (query.startsWith("#")) {
      const rest = query.slice(1).toLowerCase();
      const matches = (tags.data ?? [])
        .map((t) => ({ ...t, score: fuzzyScore(rest, t.name) }))
        .filter((t) => t.score > 0 || rest === "")
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      for (const t of matches) {
        out.push({ kind: "tag", name: t.name, color: t.color });
      }
      return out;
    }

    if (query.startsWith("@")) {
      const rest = query.slice(1);
      const matches = (lists.data ?? [])
        .map((l) => ({ ...l, score: fuzzyScore(rest, l.name) }))
        .filter((l) => l.score > 0 || rest === "")
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      for (const l of matches) {
        out.push({ kind: "list", id: l.id, name: l.name, color: l.color });
      }
      return out;
    }

    // Default: tasks (server-filtered already) + a few suggested commands
    if (!query) {
      for (const c of STATIC_COMMANDS) {
        out.push({ kind: "command", label: c.label, href: c.href, icon: c.icon });
      }
      return out;
    }

    const scored = tasks
      .map((t) => ({ t, score: fuzzyScore(query, t.title) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    for (const { t } of scored) {
      out.push({ kind: "task", id: t.id, title: t.title, subtitle: t.completed_at ? "Completed" : undefined });
    }
    return out;
  }, [q, tasks, lists.data, tags.data, openQuickAdd, setPaletteOpen]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  function commit(item: Item) {
    setPaletteOpen(false);
    switch (item.kind) {
      case "command":
        if (item.action) item.action();
        else if (item.href) router.push(item.href);
        return;
      case "list":
        router.push(`/projects/${item.id}` as Route);
        return;
      case "task":
        openTask(item.id);
        return;
      case "tag":
        router.push(`/tags/${encodeURIComponent(item.name)}` as Route);
        return;
    }
  }

  if (!paletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[10vh] backdrop-blur-sm"
      onClick={() => setPaletteOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="pulse-pane w-full max-w-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <ModeIcon q={q} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks · /command · #tag · @project"
            className="flex-1 bg-transparent text-sm outline-none"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(items.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const it = items[active];
                if (it) commit(it);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setPaletteOpen(false);
              }
            }}
          />
          <span className="pulse-kbd">Esc</span>
        </div>

        <ul className="max-h-[60vh] overflow-y-auto py-1">
          {items.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              No matches
            </li>
          )}
          {items.map((it, i) => (
            <li key={`${it.kind}-${i}`}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(it)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  i === active ? "bg-muted text-foreground" : "hover:bg-muted/50"
                }`}
              >
                <ItemIcon item={it} />
                <ItemLabel item={it} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ModeIcon({ q }: { q: string }) {
  const c = q[0];
  if (c === "/") return <Slash className="h-4 w-4 text-muted-foreground" />;
  if (c === "#") return <Hash className="h-4 w-4 text-muted-foreground" />;
  if (c === "@") return <AtSign className="h-4 w-4 text-muted-foreground" />;
  return <Search className="h-4 w-4 text-muted-foreground" />;
}

function ItemIcon({ item }: { item: Item }) {
  if (item.kind === "command") {
    const I = item.icon;
    return <I className="h-4 w-4 text-muted-foreground" />;
  }
  if (item.kind === "list") {
    return (
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: item.color || "#6b7280" }}
      />
    );
  }
  if (item.kind === "tag") {
    return (
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: item.color || "#9ca3af" }}
      />
    );
  }
  return <Search className="h-4 w-4 text-muted-foreground" />;
}

function ItemLabel({ item }: { item: Item }) {
  if (item.kind === "command") {
    return <span>{item.label}</span>;
  }
  if (item.kind === "list") {
    return (
      <span className="flex flex-1 items-center gap-2">
        <span className="truncate">{item.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">Project</span>
      </span>
    );
  }
  if (item.kind === "tag") {
    return (
      <span className="flex flex-1 items-center gap-2">
        <span className="truncate">#{item.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">Tag</span>
      </span>
    );
  }
  return (
    <span className="flex flex-1 flex-col">
      <span className="truncate">{item.title}</span>
      {item.subtitle && <span className="text-xs text-muted-foreground">{item.subtitle}</span>}
    </span>
  );
}
