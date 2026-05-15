"use client";

import { useRef } from "react";
import { useUpdateTask, useMaterializeException } from "@/lib/tasks/queries";
import { formatTime, isSameDay } from "@/lib/date";
import { HOUR_PX, SLOTS_PER_DAY, SLOT_MINUTES, SLOT_PX, snapMinutes } from "./calendar-grid";
import { EventBlock } from "./event-block";
import type { VirtualTask } from "@/lib/tasks/recurrence";

export function DayColumn({
  date,
  instances,
  showHours = false,
  isToday = false,
}: {
  date: Date;
  instances: VirtualTask[];
  showHours?: boolean;
  isToday?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const update = useUpdateTask();
  const materialize = useMaterializeException();

  const dayInstances = instances.filter((t) => {
    const anchor = t.start_at ? new Date(t.start_at) : null;
    return anchor && isSameDay(anchor, date);
  });

  // Naive single-lane layout for v1. Overlap detection comes later.
  const timed = dayInstances.filter((t) => t.start_at);
  const lanes = layoutLanes(timed);

  function dropY(e: React.DragEvent): number {
    if (!ref.current) return 0;
    const rect = ref.current.getBoundingClientRect();
    return e.clientY - rect.top + ref.current.scrollTop;
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/x-pulse-event");
    if (!raw) return;
    const payload = JSON.parse(raw) as {
      taskId: string;
      virtual: boolean;
      occursOn?: string;
      duration?: number;
      kind: "move" | "schedule";
    };

    const y = dropY(e);
    const totalMinutes = snapMinutes((y / SLOT_PX) * SLOT_MINUTES);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    target.setMinutes(totalMinutes);
    const duration = payload.duration ?? 30;

    if (payload.kind === "move" && payload.virtual && payload.occursOn) {
      await materialize.mutateAsync({
        templateId: payload.taskId,
        occursOn: payload.occursOn,
        patch: { start_at: target.toISOString(), duration_minutes: duration },
      });
      return;
    }
    await update.mutateAsync({
      id: payload.taskId,
      patch: {
        start_at: target.toISOString(),
        duration_minutes: duration,
        all_day: false,
      },
    });
  }

  function handleDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes("application/x-pulse-event")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  }

  return (
    <div
      ref={ref}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative overflow-y-auto"
      style={{ height: HOUR_PX * 24 }}
    >
      {/* Hour grid lines */}
      {Array.from({ length: 24 }).map((_, h) => (
        <div
          key={h}
          className="pointer-events-none absolute inset-x-0 border-t border-border/40"
          style={{ top: h * HOUR_PX, height: HOUR_PX }}
        >
          {showHours && (
            <div className="absolute -top-1.5 left-1 text-[10px] text-muted-foreground/70">
              {h === 0 ? "" : `${h}:00`}
            </div>
          )}
        </div>
      ))}
      {/* Half-hour ghost lines */}
      {Array.from({ length: 24 }).map((_, h) => (
        <div
          key={`half-${h}`}
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/20"
          style={{ top: h * HOUR_PX + HOUR_PX / 2 }}
        />
      ))}

      {/* Now line */}
      {isToday && <NowLine />}

      {/* Events */}
      {lanes.map(({ task, lane, laneCount }) => (
        <EventBlock key={task.id} task={task} laneCount={laneCount} laneIndex={lane} />
      ))}
    </div>
  );
}

function NowLine() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const top = (minutes / SLOT_MINUTES) * SLOT_PX;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20"
      style={{ top }}
      aria-hidden
    >
      <div className="relative">
        <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-rose-500" />
        <div className="h-px bg-rose-500" />
      </div>
    </div>
  );
}

function layoutLanes(timed: VirtualTask[]) {
  // simple greedy: place each event in the first lane whose last event ended before this starts
  const lanes: VirtualTask[][] = [];
  const assigned: Array<{ task: VirtualTask; lane: number }> = [];

  const sorted = [...timed].sort(
    (a, b) => new Date(a.start_at!).getTime() - new Date(b.start_at!).getTime()
  );

  for (const t of sorted) {
    const start = new Date(t.start_at!).getTime();
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      const last = lanes[i][lanes[i].length - 1];
      const lastEnd =
        new Date(last.start_at!).getTime() + (last.duration_minutes ?? 30) * 60_000;
      if (start >= lastEnd) {
        lanes[i].push(t);
        assigned.push({ task: t, lane: i });
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([t]);
      assigned.push({ task: t, lane: lanes.length - 1 });
    }
  }
  const laneCount = Math.max(1, lanes.length);
  return assigned.map((x) => ({ ...x, laneCount }));
}

export function HourGutter() {
  return (
    <div className="relative shrink-0" style={{ width: 40, height: HOUR_PX * 24 }}>
      {Array.from({ length: 24 }).map((_, h) => (
        <div
          key={h}
          className="absolute left-0 right-0 text-right text-[10px] text-muted-foreground/70"
          style={{ top: h * HOUR_PX - 6 }}
        >
          <span className="pr-1.5">{h === 0 ? "" : formatHour(h)}</span>
        </div>
      ))}
    </div>
  );
}

function formatHour(h: number) {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return formatTime(d);
}

/* tiny helper exposed for other views */
export function totalCanvasHeight() {
  return HOUR_PX * 24;
}

void SLOTS_PER_DAY;
