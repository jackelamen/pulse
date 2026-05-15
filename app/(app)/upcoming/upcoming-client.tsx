"use client";

import { useMemo } from "react";
import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskRow } from "@/components/tasks/task-row";
import { useTasksInWindow } from "@/lib/tasks/queries";
import { expandRecurrences, ymd } from "@/lib/tasks/recurrence";
import { addDays, dayLabel, startOfDay } from "@/lib/date";
import type { VirtualTask } from "@/lib/tasks/recurrence";

const DAYS_AHEAD = 30;
const WEEK_DAYS = 7;

export function UpcomingClient() {
  const today = startOfDay(new Date());
  const end = addDays(today, DAYS_AHEAD);
  const { data } = useTasksInWindow(today, end);

  const buckets = useMemo(() => {
    const instances = expandRecurrences(data ?? [], { start: today, end });
    // Group by ymd of the anchor (start_at or due_at)
    const m = new Map<string, VirtualTask[]>();
    for (let i = 0; i < DAYS_AHEAD; i++) {
      m.set(ymd(addDays(today, i)), []);
    }
    for (const t of instances) {
      const anchor = t.start_at ? new Date(t.start_at) : t.due_at ? new Date(t.due_at) : null;
      if (!anchor) continue;
      const key = ymd(anchor);
      if (m.has(key)) m.get(key)!.push(t);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div className="space-y-6">
      <QuickAdd placeholder="Add task (try `next mon 9am`, `fri !high`)" />

      {/* Week strip */}
      <section>
        <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          This week
        </h2>
        <div className="space-y-2">
          {Array.from({ length: WEEK_DAYS }).map((_, i) => {
            const d = addDays(today, i);
            const key = ymd(d);
            const items = buckets.get(key) ?? [];
            return <DayBucket key={key} date={d} today={today} items={items} />;
          })}
        </div>
      </section>

      {/* Next 30 list */}
      <section>
        <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Beyond this week
        </h2>
        <div className="space-y-2">
          {Array.from({ length: DAYS_AHEAD - WEEK_DAYS }).map((_, i) => {
            const d = addDays(today, WEEK_DAYS + i);
            const key = ymd(d);
            const items = buckets.get(key) ?? [];
            if (items.length === 0) {
              return (
                <div key={key} className="flex items-center gap-3 px-2 py-1 text-xs text-muted-foreground/50">
                  <span className="w-32 shrink-0">{dayLabel(d, today)}</span>
                  <span className="italic">(empty)</span>
                </div>
              );
            }
            return <DayBucket key={key} date={d} today={today} items={items} />;
          })}
        </div>
      </section>
    </div>
  );
}

function DayBucket({ date, today, items }: { date: Date; today: Date; items: VirtualTask[] }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 px-2 py-2">
      <div className="mb-1 flex items-baseline gap-2 px-2">
        <span className="font-display text-sm font-semibold">{dayLabel(date, today)}</span>
        <span className="text-[11px] text-muted-foreground">
          {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="px-2 py-1 text-xs text-muted-foreground/60">No tasks.</div>
      ) : (
        <ul className="space-y-0.5">
          {items.map((t) => (
            <TaskRow key={t.id} task={t} dense />
          ))}
        </ul>
      )}
    </div>
  );
}
