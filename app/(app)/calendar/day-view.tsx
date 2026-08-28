"use client";

import { useRef } from "react";
import { DayColumn, HourGutter } from "./day-column";
import { useInitialScroll } from "./use-initial-scroll";
import { isSameDay } from "@/lib/date";
import { ymd } from "@/lib/tasks/recurrence";
import type { VirtualTask } from "@/lib/tasks/recurrence";

export function DayView({ date, instances }: { date: Date; instances: VirtualTask[] }) {
  const today = isSameDay(date, new Date());
  const scroller = useRef<HTMLDivElement>(null);
  useInitialScroll(scroller, { dayKey: ymd(date), showsToday: today });

  return (
    /*
     * The gutter and the day column must live inside the SAME scroll
     * container. Previously the scroller wrapped only the column, leaving the
     * gutter pinned outside it -- so scrolling the day slid the events out of
     * register with the hour labels beside them and every event appeared at
     * the wrong time. (The week view already nested them correctly, which is
     * why only the day view was affected.)
     */
    <div ref={scroller} className="flex h-full overflow-y-auto">
      <HourGutter />
      <div className="flex-1">
        <DayColumn date={date} instances={instances} isToday={today} showHours={false} />
      </div>
    </div>
  );
}
