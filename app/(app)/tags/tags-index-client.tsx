"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDeleteTag, useRenameTag, useTags } from "@/lib/lists/queries";
import { tagColor } from "@/lib/lists/tag-colors";

export function TagsIndexClient() {
  const tags = useTags();
  const renameTag = useRenameTag();
  const deleteTag = useDeleteTag();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Aggregate tag usage from tasks. Cheap because RLS already scopes it.
  const counts = useQuery({
    queryKey: ["tags", "counts"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("tasks")
        .select("tags")
        .is("deleted_at", null);
      const map: Record<string, number> = {};
      const rows = (data ?? []) as Array<{ tags: string[] | null }>;
      for (const row of rows) {
        for (const t of (row.tags ?? []) as string[]) map[t] = (map[t] ?? 0) + 1;
      }
      return map;
    },
  });

  const rows = useMemo(() => {
    const taskCounts = counts.data ?? {};
    const known = new Set<string>(Object.keys(taskCounts));
    for (const t of tags.data ?? []) known.add(t.name);
    return Array.from(known)
      .map((name) => ({
        name,
        explicitColor: tags.data?.find((x) => x.name === name)?.color ?? null,
        count: taskCounts[name] ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [counts.data, tags.data]);

  if (rows.length === 0) {
    return (
      <div className="pulse-pane px-6 py-10 text-center text-sm text-muted-foreground">
        No tags yet. Add <span className="pulse-kbd">#tag</span> in a quick-add and they&apos;ll show up here.
      </div>
    );
  }

  const startEditing = (name: string) => {
    setEditing(name);
    setDraft(name);
    setError(null);
  };

  const saveRename = async (name: string) => {
    const next = draft.trim().replace(/^#/, "").toLowerCase();
    if (!next) {
      setError("Tag name cannot be blank.");
      return;
    }
    try {
      await renameTag.mutateAsync({ oldName: name, newName: next });
      await counts.refetch();
      setEditing(null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename tag.");
    }
  };

  const removeTag = async (name: string, count: number) => {
    const ok = window.confirm(
      count > 0
        ? `Delete #${name}? This removes the tag from ${count} task${count === 1 ? "" : "s"}, but keeps the task${count === 1 ? "" : "s"}.`
        : `Delete #${name}?`
    );
    if (!ok) return;
    try {
      await deleteTag.mutateAsync(name);
      await counts.refetch();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete tag.");
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <ul className="space-y-1">
        {rows.map(({ name, explicitColor, count }) => {
          const isEditing = editing === name;
          const pending = renameTag.isPending || deleteTag.isPending;
          return (
            <li key={name} className="pulse-row">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: tagColor(name, explicitColor) }}
              />
              {isEditing ? (
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveRename(name);
                    if (e.key === "Escape") setEditing(null);
                  }}
                  autoFocus
                  className="h-8 min-w-0 flex-1"
                />
              ) : (
                <Link
                  href={`/tags/${encodeURIComponent(name)}`}
                  className="min-w-0 flex-1 truncate text-sm font-medium"
                >
                  #{name}
                </Link>
              )}
              <span className="min-w-6 text-right text-xs text-muted-foreground">{count}</span>
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={pending}
                    onClick={() => void saveRename(name)}
                    aria-label={`Save #${name}`}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={pending}
                    onClick={() => setEditing(null)}
                    aria-label="Cancel edit"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={pending}
                    onClick={() => startEditing(name)}
                    aria-label={`Rename #${name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={pending}
                    onClick={() => void removeTag(name, count)}
                    aria-label={`Delete #${name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
