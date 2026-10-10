"use client";

import { useUi } from "@/lib/ui/store";
import { useUpdateTask, useMaterializeException } from "@/lib/tasks/queries";
import { allDayAnchor, isSameDay, taskAnchor } from "@/lib/date";
import { tagColor } from "@/lib/lists/tag-colors";
import { GUTTER_PX } from "./calendar-grid";
import type { VirtualTask } from "@/lib/tasks/recurrence";

/** True for anything that belongs in the all-day strip rather than the hour grid. */
export function isAllDay(t: VirtualTask): boolean {
  return t.all_day && !!taskAnchor(t);
}

/**
 * Strip of all-day items above the hour grid, one cell per visible day.
 * Busy items are solid; free items are outlined so a glance shows which
 * all-day entries actually block the day. Dropping a task here makes it
 * all-day on that date.
 */
export function AllDayRow({
  days,
  instances,
}: {
  days: Date[];
  instances: VirtualTask[];
}) {
  const allDay = instances.filter(isAllDay);

  return (
    <div className="flex shrink-0 border-b border-border bg-muted/10">
      <div
        className="flex shrink-0 items-start justify-end pr-2 pt-1.5 text-right font-mono text-[10px] leading-tight text-muted-foreground"
        style={{ width: GUTTER_PX }}
      >
        all-day
      </div>
      <div
        className="grid flex-1 divide-x divide-border"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {days.map((d) => (
          <AllDayCell
            key={d.toISOString()}
            date={d}
            items={allDay.filter((t) => isSameDay(new Date(taskAnchor(t)!), d))}
          />
        ))}
      </div>
    </div>
  );
}

function AllDayCell({ date, items }: { date: Date; items: VirtualTask[] }) {
  const update = useUpdateTask();
  const materialize = useMaterializeException();

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/x-pulse-event");
    if (!raw) return;
    const payload = JSON.parse(raw) as {
      taskId: string;
      virtual: boolean;
      occursOn?: string;
    };
    const patch = { start_at: allDayAnchor(date).toISOString(), all_day: true };
    if (payload.virtual && payload.occursOn) {
      await materialize.mutateAsync({
        templateId: payload.taskId,
        occursOn: payload.occursOn,
        patch,
      });
      return;
    }
    await update.mutateAsync({ id: payload.taskId, patch });
  }

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-pulse-event")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={handleDrop}
      className="min-h-[28px] space-y-0.5 p-0.5"
    >
      {items.map((t) => (
        <AllDayChip key={t.id} task={t} />
      ))}
    </div>
  );
}

function AllDayChip({ task }: { task: VirtualTask }) {
  const openTask = useUi((s) => s.openTask);
  const accent = task.tags.length > 0 ? tagColor(task.tags[0]) : "#6b7280";

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData(
      "application/x-pulse-event",
      JSON.stringify({
        taskId: task.virtual ? task.template_id : task.id,
        virtual: task.virtual,
        occursOn: task.occurs_on,
        duration: task.duration_minutes ?? 30,
        allDay: true,
        kind: "move",
      })
    );
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <button
      type="button"
      draggable
      onDragStart={handleDragStart}
      onClick={() => openTask(task.id)}
      title={`${task.title} · ${task.busy ? "Busy" : "Free"}`}
      className="block w-full cursor-grab truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium active:cursor-grabbing"
      style={
        task.busy
          ? { background: accent, color: "#fff" }
          : { background: `${accent}1f`, color: accent, border: `1px solid ${accent}` }
      }
    >
      {task.title}
    </button>
  );
}
