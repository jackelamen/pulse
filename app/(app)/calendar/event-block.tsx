"use client";

import { useUpdateTask, useMaterializeException } from "@/lib/tasks/queries";
import { tagColor } from "@/lib/lists/tag-colors";
import { formatTime } from "@/lib/date";
import { HOUR_PX, SLOT_PX, SLOT_MINUTES, minutesToPx, snapMinutes } from "./calendar-grid";
import type { VirtualTask } from "@/lib/tasks/recurrence";

export function EventBlock({
  task,
  laneCount = 1,
  laneIndex = 0,
}: {
  task: VirtualTask;
  laneCount?: number;
  laneIndex?: number;
}) {
  const update = useUpdateTask();
  const materialize = useMaterializeException();
  if (!task.start_at) return null;

  const start = new Date(task.start_at);
  const minFromMidnight = start.getHours() * 60 + start.getMinutes();
  const duration = task.duration_minutes ?? 30;

  const top = minutesToPx(minFromMidnight);
  const height = Math.max(SLOT_PX, minutesToPx(duration)); // never thinner than one slot
  const widthPct = 100 / laneCount;

  const accent = task.tags.length > 0 ? tagColor(task.tags[0]) : "#6b7280";

  async function moveTo(newStart: Date) {
    if (task.virtual && task.template_id) {
      await materialize.mutateAsync({
        templateId: task.template_id,
        occursOn: task.occurs_on,
        patch: { start_at: newStart.toISOString() },
      });
    } else {
      await update.mutateAsync({ id: task.id, patch: { start_at: newStart.toISOString() } });
    }
  }

  async function resizeTo(newDuration: number) {
    if (task.virtual && task.template_id) {
      await materialize.mutateAsync({
        templateId: task.template_id,
        occursOn: task.occurs_on,
        patch: { duration_minutes: newDuration },
      });
    } else {
      await update.mutateAsync({ id: task.id, patch: { duration_minutes: newDuration } });
    }
  }

  function handleDragStart(e: React.DragEvent) {
    const payload = JSON.stringify({
      taskId: task.virtual ? task.template_id : task.id,
      virtual: task.virtual,
      occursOn: task.occurs_on,
      duration,
      kind: "move",
    });
    e.dataTransfer.setData("application/x-pulse-event", payload);
    e.dataTransfer.effectAllowed = "move";
  }

  // Resize handle: vertical drag from the bottom edge updates duration.
  function handleResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startDuration = duration;
    function onMove(ev: MouseEvent) {
      const dy = ev.clientY - startY;
      const minutes = startDuration + (dy / SLOT_PX) * SLOT_MINUTES;
      const snapped = Math.max(SLOT_MINUTES, snapMinutes(minutes));
      const el = document.getElementById(`evt-${task.id}`);
      if (el) el.style.height = `${minutesToPx(snapped)}px`;
    }
    function onUp(ev: MouseEvent) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const dy = ev.clientY - startY;
      const minutes = startDuration + (dy / SLOT_PX) * SLOT_MINUTES;
      const snapped = Math.max(SLOT_MINUTES, snapMinutes(minutes));
      if (snapped !== startDuration) resizeTo(snapped);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  void moveTo; // moveTo is used by the canvas drop handler via dataTransfer

  return (
    <div
      id={`evt-${task.id}`}
      draggable
      onDragStart={handleDragStart}
      className="group absolute z-10 cursor-grab overflow-hidden rounded-md border border-white/20 px-2 py-1 text-[11px] text-white shadow-sm active:cursor-grabbing"
      style={{
        top,
        height,
        left: `calc(${widthPct * laneIndex}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
      }}
      title={task.title}
    >
      <div className="truncate font-medium leading-tight">{task.title}</div>
      {height > HOUR_PX * 0.5 && (
        <div className="truncate text-[10px] text-white/80">
          {formatTime(start)} · {duration}m
        </div>
      )}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: "rgba(255,255,255,0.3)" }}
        aria-label="Resize"
      />
    </div>
  );
}
