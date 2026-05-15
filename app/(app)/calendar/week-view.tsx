"use client";

import { addDays, isSameDay, startOfWeek } from "@/lib/date";
import { DayColumn, HourGutter } from "./day-column";
import type { VirtualTask } from "@/lib/tasks/recurrence";

export function WeekView({ anchor, instances }: { anchor: Date; instances: VirtualTask[] }) {
  const start = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();

  return (
    <div className="flex h-full flex-col">
      {/* Header row with day labels */}
      <div className="flex shrink-0 border-b border-border bg-muted/20">
        <div style={{ width: 40 }} />
        <div className="grid flex-1 grid-cols-7 divide-x divide-border">
          {days.map((d) => {
            const isToday = isSameDay(d, today);
            return (
              <div
                key={d.toISOString()}
                className={`px-2 py-2 text-center ${isToday ? "text-primary" : "text-muted-foreground"}`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider">
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
                <div className={`text-lg font-display ${isToday ? "font-bold" : "font-medium"}`}>
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-y-auto">
        <HourGutter />
        <div className="grid flex-1 grid-cols-7 divide-x divide-border">
          {days.map((d) => (
            <DayColumn
              key={d.toISOString()}
              date={d}
              instances={instances}
              isToday={isSameDay(d, today)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
