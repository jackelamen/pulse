"use client";

import { useUpdateTask, useMaterializeException } from "@/lib/tasks/queries";
import { addDays, allDayAnchor, isSameDay, startOfMonth, startOfWeek, taskAnchor } from "@/lib/date";
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
    const anchorIso = taskAnchor(t);
    const a = anchorIso ? new Date(anchorIso) : null;
    if (!a) continue;
    const key = ymd(a);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(t);
  }
  // All-day items first, then by time, so the 3-item cap never hides them.
  for (const list of byDay.values()) {
    list.sort(
      (a, b) =>
        Number(b.all_day) - Number(a.all_day) ||
        taskAnchor(a)!.localeCompare(taskAnchor(b)!)
    );
  }

  const update = useUpdateTask();
  const materialize = useMaterializeException();

  async function handleDrop(e: React.DragEvent, day: Date) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/x-pulse-event");
    if (!raw) return;
    const payload = JSON.parse(raw);
    const target = new Date(day);
    // All-day items stay all-day when moved; everything else lands at 9am.
    const allDay = !!payload.allDay;
    if (allDay) target.setTime(allDayAnchor(day).getTime());
    else target.setHours(9, 0, 0, 0);
    if (payload.virtual && payload.occursOn) {
      await materialize.mutateAsync({
        templateId: payload.taskId,
        occursOn: payload.occursOn,
        patch: { start_at: target.toISOString() },
      });
    } else {
      await update.mutateAsync({
        id: payload.taskId,
        patch: { start_at: target.toISOString(), all_day: allDay },
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
                inMonth ? "" : "bg-muted/10 text-muted-foreground/70"
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
                      draggable={t.all_day}
                      onDragStart={(e) => {
                        if (!t.all_day) return;
                        e.dataTransfer.setData(
                          "application/x-pulse-event",
                          JSON.stringify({
                            taskId: t.virtual ? t.template_id : t.id,
                            virtual: t.virtual,
                            occursOn: t.occurs_on,
                            allDay: true,
                            kind: "move",
                          })
                        );
                      }}
                      className={`truncate rounded px-1 text-[10px] ${t.busy ? "text-white" : ""}`}
                      style={
                        t.busy
                          ? { background: c }
                          : { background: `${c}1f`, color: c, border: `1px solid ${c}` }
                      }
                      title={`${t.title}${t.all_day ? " · all day" : ""}${t.busy ? "" : " · free"}`}
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
