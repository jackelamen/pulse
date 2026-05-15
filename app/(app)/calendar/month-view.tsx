"use client";

import { useUpdateTask, useMaterializeException } from "@/lib/tasks/queries";
import { addDays, isSameDay, startOfMonth, startOfWeek } from "@/lib/date";
import { tagColor } from "@/lib/lists/tag-colors";
import { ymd } from "@/lib/tasks/recurrence";
import type { VirtualTask } from "@/lib/tasks/recurrence";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthView({ anchor, instances }: { anchor: Date; instances: VirtualTask[] }) {
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();
  const month = anchor.getMonth();

  // bucket by ymd
  const byDay = new Map<string, VirtualTask[]>();
  for (const t of instances) {
    const a = t.start_at ? new Date(t.start_at) : t.due_at ? new Date(t.due_at) : null;
    if (!a) continue;
    const key = ymd(a);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(t);
  }

  const update = useUpdateTask();
  const materialize = useMaterializeException();

  async function handleDrop(e: React.DragEvent, day: Date) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/x-pulse-event");
    if (!raw) return;
    const payload = JSON.parse(raw);
    const target = new Date(day);
    target.setHours(9, 0, 0, 0); // default 9am drop on month view
    if (payload.virtual && payload.occursOn) {
      await materialize.mutateAsync({
        templateId: payload.taskId,
        occursOn: payload.occursOn,
        patch: { start_at: target.toISOString() },
      });
    } else {
      await update.mutateAsync({
        id: payload.taskId,
        patch: { start_at: target.toISOString(), all_day: false },
      });
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="grid shrink-0 grid-cols-7 border-b border-border bg-muted/20 text-center">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {cells.map((d) => {
          const inMonth = d.getMonth() === month;
          const isToday = isSameDay(d, today);
          const items = byDay.get(ymd(d)) ?? [];
          return (
            <div
              key={d.toISOString()}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("application/x-pulse-event")) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(e) => handleDrop(e, d)}
              className={`min-h-0 border-b border-r border-border p-1.5 transition-colors hover:bg-muted/30 ${
                inMonth ? "" : "bg-muted/10 text-muted-foreground/50"
              }`}
            >
              <div
                className={`mb-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs ${
                  isToday ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((t) => {
                  const c = t.tags[0] ? tagColor(t.tags[0]) : "#6b7280";
                  return (
                    <div
                      key={t.id}
                      className="truncate rounded px-1 text-[10px] text-white"
                      style={{ background: c }}
                      title={t.title}
                    >
                      {t.title}
                    </div>
                  );
                })}
                {items.length > 3 && (
                  <div className="px-1 text-[10px] text-muted-foreground">
                    +{items.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
