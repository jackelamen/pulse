"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, CalendarClock, Flag, Hash, Plus, Repeat, ListChecks, Timer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useMaterializeException,
  useSubtasks,
  useToggleComplete,
} from "@/lib/tasks/queries";
import { useLists } from "@/lib/lists/queries";
import { useUi } from "@/lib/ui/store";
import {
  RECURRENCE_PRESETS,
  type RecurrencePreset,
  recurrenceLabel,
} from "@/lib/tasks/recurrence";
import type { Task, Priority } from "@/lib/tasks/types";

/**
 * TaskDetail panel.
 *
 * Opens via the global UI store's `selectedTaskId`. Handles both real and
 * virtual instances — for a virtual instance (`templateId:YYYY-MM-DD`) the
 * panel fetches the template, displays its values, and materializes a real
 * row on first edit.
 */
export function TaskDetail() {
  const { selectedTaskId, openTask } = useUi();
  if (!selectedTaskId) return null;
  return <Panel selectedId={selectedTaskId} onClose={() => openTask(null)} />;
}

function Panel({ selectedId, onClose }: { selectedId: string; onClose: () => void }) {
  // Decode synthetic ids for virtual instances
  const virtual = selectedId.includes(":");
  const templateId = virtual ? selectedId.split(":")[0] : selectedId;
  const occursOn = virtual ? selectedId.split(":")[1] : null;

  const task = useQuery({
    queryKey: ["tasks", "detail", templateId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", templateId)
        .single();
      if (error) throw error;
      return data as Task;
    },
  });

  const lists = useLists();
  const subtasks = useSubtasks(templateId);
  const createTask = useCreateTask();
  const update = useUpdateTask();
  const toggleComplete = useToggleComplete();
  const materialize = useMaterializeException();
  const remove = useDeleteTask();

  const [draft, setDraft] = useState<Partial<Task>>({});
  const [checklistTitle, setChecklistTitle] = useState("");

  useEffect(() => {
    if (task.data) setDraft({});
  }, [task.data]);

  const value = useMemo<Task | null>(() => {
    if (!task.data) return null;
    return { ...task.data, ...draft } as Task;
  }, [task.data, draft]);

  async function persist(patch: Partial<Task>) {
    setDraft((d) => ({ ...d, ...patch }));
    if (virtual && occursOn) {
      await materialize.mutateAsync({ templateId, occursOn, patch });
      onClose();
      return;
    }
    await update.mutateAsync({ id: templateId, patch });
  }

  async function addChecklistItem() {
    const title = checklistTitle.trim();
    if (!title || !value) return;
    await createTask.mutateAsync({
      title,
      parent_task_id: templateId,
      list_id: value.list_id,
      priority: 0,
      sort_order: Date.now(),
    });
    setChecklistTitle("");
  }

  if (!value) {
    return (
      <Drawer onClose={onClose}>
        <div className="p-4 text-sm text-muted-foreground">Loading…</div>
      </Drawer>
    );
  }

  return (
    <Drawer onClose={onClose}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button onClick={onClose} className="rounded p-1 hover:bg-muted" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
        <span className="text-xs text-muted-foreground">
          {virtual ? "Recurrence instance" : "Task"}
        </span>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              if (!confirm("Delete this task?")) return;
              await remove.mutateAsync(templateId);
              onClose();
            }}
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Title */}
        <Input
          value={value.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== task.data?.title) {
              persist({ title: e.target.value.trim() });
            }
          }}
          className="border-0 px-0 text-lg font-medium shadow-none focus-visible:ring-0"
          placeholder="Title"
        />

        {/* Notes */}
        <textarea
          value={value.notes ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          onBlur={(e) => persist({ notes: e.target.value || null })}
          placeholder="Notes…"
          className="mt-2 min-h-[80px] w-full resize-y rounded-md border border-border bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <section className="mt-4 rounded-2xl border border-border bg-muted/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <ListChecks className="h-3.5 w-3.5" />
              Checklist
            </div>
            {(subtasks.data ?? []).length > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {(subtasks.data ?? []).filter((item) => item.completed_at).length}/
                {(subtasks.data ?? []).length} done
              </span>
            )}
          </div>

          {(subtasks.data ?? []).length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {(subtasks.data ?? []).map((item) => (
                <ChecklistItem
                  key={item.id}
                  item={item}
                  onToggle={() => toggleComplete.mutate(item)}
                  onRename={(title) => update.mutate({ id: item.id, patch: { title } })}
                  onDelete={() => remove.mutate(item.id)}
                />
              ))}
            </ul>
          )}

          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addChecklistItem();
            }}
          >
            <Plus className="h-4 w-4 shrink-0 text-primary" />
            <input
              value={checklistTitle}
              onChange={(e) => setChecklistTitle(e.target.value)}
              placeholder="Add checklist item"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button
              type="submit"
              size="sm"
              variant={checklistTitle.trim() ? "default" : "ghost"}
              disabled={!checklistTitle.trim() || createTask.isPending}
            >
              Add
            </Button>
          </form>
        </section>

        {/* Metadata rows */}
        <div className="mt-4 space-y-3 text-sm">
          <Row icon={<ListChecks className="h-4 w-4 text-muted-foreground" />} label="Project">
            <select
              value={value.list_id ?? ""}
              onChange={(e) => persist({ list_id: e.target.value || null })}
              className="rounded-md border border-border bg-card px-2 py-1 text-sm"
            >
              <option value="">No project</option>
              {(lists.data ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Row>

          <Row icon={<Flag className="h-4 w-4 text-muted-foreground" />} label="Priority">
            <PriorityPicker
              value={value.priority}
              onChange={(p) => persist({ priority: p })}
            />
          </Row>

          <Row icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />} label="Starts">
            <input
              type="datetime-local"
              value={toLocalInput(value.start_at)}
              onChange={(e) =>
                persist({ start_at: fromLocalInput(e.target.value) })
              }
              className="rounded-md border border-border bg-card px-2 py-1 text-sm"
            />
          </Row>

          <Row icon={<Timer className="h-4 w-4 text-muted-foreground" />} label="Duration">
            <DurationPicker
              value={value.duration_minutes}
              onChange={(duration) => persist({ duration_minutes: duration })}
            />
          </Row>

          <Row icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />} label="Due">
            <input
              type="datetime-local"
              value={toLocalInput(value.due_at)}
              onChange={(e) =>
                persist({ due_at: fromLocalInput(e.target.value) })
              }
              className="rounded-md border border-border bg-card px-2 py-1 text-sm"
            />
          </Row>

          <Row icon={<Hash className="h-4 w-4 text-muted-foreground" />} label="Tags">
            <input
              defaultValue={(value.tags ?? []).join(" ")}
              onBlur={(e) =>
                persist({
                  tags: e.target.value
                    .split(/\s+/)
                    .map((t) => t.replace(/^#/, "").trim().toLowerCase())
                    .filter(Boolean),
                })
              }
              placeholder="work home deep-focus"
              className="w-full rounded-md border border-border bg-card px-2 py-1 text-sm"
            />
          </Row>

          <Row icon={<Repeat className="h-4 w-4 text-muted-foreground" />} label="Repeats">
            <RecurrencePicker
              value={value.recurrence_rule}
              onChange={(rule) => persist({ recurrence_rule: rule })}
            />
          </Row>
        </div>
      </div>
    </Drawer>
  );
}

function ChecklistItem({
  item,
  onToggle,
  onRename,
  onDelete,
}: {
  item: Task;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(item.title);

  useEffect(() => {
    setTitle(item.title);
  }, [item.title]);

  function commit() {
    const next = title.trim();
    if (!next) {
      setTitle(item.title);
      return;
    }
    if (next !== item.title) onRename(next);
  }

  return (
    <li className="group flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5">
      <input
        type="checkbox"
        checked={!!item.completed_at}
        onChange={onToggle}
        className="h-4 w-4 rounded border-border accent-primary"
        aria-label={item.completed_at ? `Mark ${item.title} incomplete` : `Complete ${item.title}`}
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setTitle(item.title);
            e.currentTarget.blur();
          }
        }}
        className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${
          item.completed_at
            ? "text-muted-foreground line-through decoration-muted-foreground/50"
            : "text-foreground"
        }`}
        aria-label="Checklist item title"
      />
      <button
        type="button"
        onClick={onDelete}
        className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={`Delete ${item.title}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        className="fixed right-0 top-0 z-40 flex h-dvh w-full flex-col bg-card shadow-2xl sm:w-[420px]"
      >
        {children}
      </aside>
    </>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-24 shrink-0 pt-1.5">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  const items: Array<{ v: Priority; label: string; dot: string }> = [
    { v: 0, label: "None", dot: "bg-muted-foreground/30" },
    { v: 1, label: "Low", dot: "bg-sky-500" },
    { v: 2, label: "Med", dot: "bg-amber-500" },
    { v: 3, label: "High", dot: "bg-rose-500" },
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it) => (
        <button
          key={it.v}
          onClick={() => onChange(it.v)}
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
            value === it.v
              ? "border-foreground/20 bg-muted text-foreground"
              : "border-transparent text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${it.dot}`} />
          {it.label}
        </button>
      ))}
    </div>
  );
}

function DurationPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (duration: number | null) => void;
}) {
  const presets = [15, 30, 45, 60, 90];
  const [draft, setDraft] = useState(value ? String(value) : "");

  useEffect(() => {
    setDraft(value ? String(value) : "");
  }, [value]);

  function commit(nextValue = draft) {
    const trimmed = nextValue.trim();
    if (!trimmed) {
      onChange(null);
      return;
    }
    const minutes = Number.parseInt(trimmed, 10);
    if (Number.isFinite(minutes) && minutes > 0 && minutes <= 24 * 60) {
      onChange(minutes);
    } else {
      setDraft(value ? String(value) : "");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {presets.map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => {
              setDraft(String(minutes));
              onChange(minutes);
            }}
            className={`rounded-md border px-2 py-1 text-xs transition-colors ${
              value === minutes
                ? "border-foreground/20 bg-muted text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {formatDuration(minutes)}
          </button>
        ))}
        {value && (
          <button
            type="button"
            onClick={() => {
              setDraft("");
              onChange(null);
            }}
            className="rounded-md border border-transparent px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={() => commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              setDraft(value ? String(value) : "");
              e.currentTarget.blur();
            }
          }}
          placeholder="Minutes"
          className="w-28 rounded-md border border-border bg-card px-2 py-1 text-sm"
        />
        <span className="text-xs text-muted-foreground">
          {value ? `${formatDuration(value)} on the timeline` : "Optional for timed tasks"}
        </span>
      </div>
    </div>
  );
}

function RecurrencePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (rule: string | null) => void;
}) {
  const presets: Array<{ key: RecurrencePreset; label: string }> = [
    { key: "none", label: "None" },
    { key: "daily", label: "Daily" },
    { key: "weekdays", label: "Weekdays" },
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
    { key: "yearly", label: "Yearly" },
  ];

  const activePreset = presets.find((p) => RECURRENCE_PRESETS[p.key] === value)?.key;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => onChange(RECURRENCE_PRESETS[p.key])}
            className={`rounded-md border px-2 py-1 text-xs transition-colors ${
              activePreset === p.key
                ? "border-foreground/20 bg-muted text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input
        defaultValue={value ?? ""}
        onBlur={(e) => onChange(e.target.value.trim() || null)}
        placeholder="Or paste an RRULE (e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR)"
        className="w-full rounded-md border border-border bg-card px-2 py-1 font-mono text-[11px]"
      />
      {value && (
        <div className="text-[11px] text-muted-foreground">
          Current: <span className="font-medium">{recurrenceLabel(value)}</span>
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

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}
