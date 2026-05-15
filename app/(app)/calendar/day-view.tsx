"use client";

import { DayColumn, HourGutter } from "./day-column";
import { isSameDay } from "@/lib/date";
import type { VirtualTask } from "@/lib/tasks/recurrence";

export function DayView({ date, instances }: { date: Date; instances: VirtualTask[] }) {
  const today = isSameDay(date, new Date());
  return (
    <div className="flex h-full">
      <HourGutter />
      <div className="flex-1 overflow-y-auto">
        <DayColumn date={date} instances={instances} isToday={today} showHours={false} />
      </div>
    </div>
  );
}
