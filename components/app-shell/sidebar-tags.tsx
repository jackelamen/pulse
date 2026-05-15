"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTags } from "@/lib/lists/queries";
import { tagColor } from "@/lib/lists/tag-colors";
import { cn } from "@/lib/utils";

export function SidebarTags() {
  const tags = useTags();
  const path = usePathname();
  const [open, setOpen] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("tasks")
        .select("tags")
        .is("deleted_at", null)
        .is("parent_task_id", null);
      const map: Record<string, number> = {};
      const rows = (data ?? []) as Array<{ tags: string[] | null }>;
      for (const row of rows) {
        for (const tag of row.tags ?? []) map[tag] = (map[tag] ?? 0) + 1;
      }
      setCounts(map);
    })();
  }, []);

  const rows = useMemo(() => {
    const known = new Set(Object.keys(counts));
    for (const tag of tags.data ?? []) known.add(tag.name);
    return Array.from(known)
      .map((name) => ({
        name,
        explicitColor: tags.data?.find((tag) => tag.name === name)?.color ?? null,
        count: counts[name] ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [counts, tags.data]);

  return (
    <div className="px-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-1.5 rounded-xl px-3 pb-1 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
        <span>Tags</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{rows.length}</span>
      </button>

      {open && (
        <div className="mt-1 space-y-0.5">
          {rows.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">No tags yet</div>
          ) : (
            rows.slice(0, 12).map(({ name, explicitColor, count }) => {
              const href = `/tags/${encodeURIComponent(name)}`;
              const active = path === href;
              return (
                <Link
                  key={name}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-card hover:text-foreground"
                  )}
                >
                  <Tag className="h-4 w-4 shrink-0" />
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: tagColor(name, explicitColor) }}
                  />
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  {count > 0 && <span className="text-xs text-muted-foreground">{count}</span>}
                </Link>
              );
            })
          )}
          {rows.length > 12 && (
            <Link
              href="/tags"
              className="block rounded-xl px-2 py-1.5 text-sm text-muted-foreground hover:bg-card hover:text-foreground"
            >
              View all tags
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
