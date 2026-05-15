"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCalendar, type CalendarMode } from "@/lib/ui/calendar-store";
import { useTasksInWindow } from "@/lib/tasks/queries";
import { expandRecurrences } from "@/lib/tasks/recurrence";
import {
  addDays,
  endOfDay,
  endOfMonth,
  formatMonthYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "@/lib/date";
import { WeekView } from "./week-view";
import { DayView } from "./day-view";
import { MonthView } from "./month-view";
import { UnscheduledRail } from "./unscheduled-rail";

export function CalendarClient() {
  const { mode, anchor, setMode, setAnchor } = useCalendar();
  const anchorDate = useMemo(() => new Date(anchor), [anchor]);

  const range = useMemo(() => computeRange(mode, anchorDate), [mode, anchorDate]);
  const { data } = useTasksInWindow(range.start, range.end);
  const instances = useMemo(
    () => expandRecurrences(data ?? [], range),
    [data, range]
  );

  function step(delta: number) {
    if (mode === "day") setAnchor(addDays(anchorDate, delta));
    else if (mode === "week") setAnchor(addDays(anchorDate, delta * 7));
    else {
      const x = new Date(anchorDate);
      x.setMonth(x.getMonth() + delta);
      setAnchor(x);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setAnchor(new Date())}>
          <CalendarDays className="mr-1 h-4 w-4" />
          Today
        </Button>
        <Button size="icon" variant="ghost" onClick={() => step(-1)} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => step(1)} aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h1 className="font-display text-lg font-semibold tracking-tight md:text-xl">
          {labelFor(mode, anchorDate)}
        </h1>

        <div className="ml-auto flex items-center gap-1 rounded-md border border-border p-0.5">
          {(["day", "week", "month"] as CalendarMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-2.5 py-1 text-xs capitalize transition-colors ${
                mode === m ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Body: rail + view */}
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="hidden min-h-0 w-56 shrink-0 lg:block">
          <UnscheduledRail />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
          {mode === "day" && <DayView date={anchorDate} instances={instances} />}
          {mode === "week" && <WeekView anchor={anchorDate} instances={instances} />}
          {mode === "month" && <MonthView anchor={anchorDate} instances={instances} />}
        </div>
      </div>
    </div>
  );
}

function labelFor(mode: CalendarMode, anchor: Date): string {
  if (mode === "day") {
    return anchor.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }
  if (mode === "week") {
    const start = startOfWeek(anchor);
    const end = addDays(start, 6);
    return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return formatMonthYear(anchor);
}

function computeRange(mode: CalendarMode, anchor: Date) {
  if (mode === "day") return { start: startOfDay(anchor), end: endOfDay(anchor) };
  if (mode === "week") {
    const start = startOfWeek(anchor);
    return { start, end: endOfDay(addDays(start, 6)) };
  }
  // month: include surrounding partial weeks so the grid is 6 rows
  const ms = startOfMonth(anchor);
  const start = startOfWeek(ms);
  const end = endOfDay(addDays(start, 6 * 7 - 1));
  // safeguard: ensure window covers all of month
  const me = endOfMonth(anchor);
  if (end < me) return { start, end: me };
  return { start, end };
}
