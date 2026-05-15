"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Flag, Hash, Plus, Timer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { parseQuickAdd } from "@/lib/tasks/parse-quick-add";
import { useCreateTask } from "@/lib/tasks/queries";
import type { TaskInsert } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

interface Props {
  defaultListId?: string | null;
  defaultTags?: string[];
  autoFocus?: boolean;
  placeholder?: string;
  /**
   * Variant. "inline" sits at the top of a list. "overlay" is the floating one
   * triggered by `n` and has its own backdrop / focus trap.
   */
  variant?: "inline" | "overlay";
  onSubmitted?: () => void;
  className?: string;
}

export function QuickAdd({
  defaultListId = null,
  defaultTags = [],
  autoFocus = false,
  placeholder = "Add task — try `Email Sarah tomorrow 9am !high #work`",
  variant = "inline",
  onSubmitted,
  className,
}: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const create = useCreateTask();

  const parsed = useMemo(() => parseQuickAdd(value), [value]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  async function submit() {
    const t = parsed.title.trim();
    if (!t) return;
    setError(null);
    const insert: TaskInsert = {
      title: t,
      priority: parsed.priority,
      tags: Array.from(new Set([...defaultTags, ...parsed.tags])),
      start_at: parsed.start_at,
      due_at: parsed.due_at,
      duration_minutes: parsed.duration_minutes,
      list_id: defaultListId ?? null,
    };
    try {
      await create.mutateAsync(insert);
      setValue("");
      onSubmitted?.();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div
      className={cn(
        "pulse-pane flex flex-col gap-3 px-4 py-3",
        variant === "overlay" && "shadow-xl",
        className
      )}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-3"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Plus className="h-4 w-4" aria-hidden />
        </span>
        <Input
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="h-11 border-0 bg-transparent px-0 text-[15px] shadow-none focus-visible:ring-0"
          aria-label="Quick add task"
        />
        <Button
          type="submit"
          size="sm"
          variant={value.trim() ? "default" : "ghost"}
          disabled={!parsed.title.trim() || create.isPending}
        >
          {create.isPending ? "Adding..." : "Add"}
        </Button>
      </form>

      {value.trim() &&
        (parsed.start_at || parsed.due_at || parsed.duration_minutes || parsed.priority > 0 || parsed.tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
          {(parsed.start_at || parsed.due_at) && (
            <Chip icon={<CalendarClock className="h-3 w-3" />}>
              {previewDate((parsed.start_at ?? parsed.due_at)!)}
            </Chip>
          )}
          {parsed.duration_minutes && (
            <Chip icon={<Timer className="h-3 w-3" />}>
              {formatDuration(parsed.duration_minutes)}
            </Chip>
          )}
          {parsed.priority > 0 && (
            <Chip icon={<Flag className="h-3 w-3" />}>
              {parsed.priority === 3 ? "High" : parsed.priority === 2 ? "Medium" : "Low"}
            </Chip>
          )}
          {parsed.tags.map((tag) => (
            <Chip key={tag} icon={<Hash className="h-3 w-3" />}>
              {tag}
            </Chip>
          ))}
          <span className="ml-auto max-w-[40%] truncate text-muted-foreground/70">{parsed.title}</span>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    const message = typeof record.message === "string" ? record.message : null;
    const details = typeof record.details === "string" ? record.details : null;
    const hint = typeof record.hint === "string" ? record.hint : null;
    return [message, details, hint].filter(Boolean).join(" ") || JSON.stringify(record);
  }
  return "Could not add task.";
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="pulse-chip">
      {icon}
      {children}
    </span>
  );
}

function previewDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  let label: string;
  if (diff === 0) label = "Today";
  else if (diff === 1) label = "Tomorrow";
  else if (diff > 1 && diff < 7) label = d.toLocaleDateString(undefined, { weekday: "long" });
  else label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const sameMidnight = d.getHours() === 0 && d.getMinutes() === 0;
  if (sameMidnight) return label;
  return `${label} ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}
