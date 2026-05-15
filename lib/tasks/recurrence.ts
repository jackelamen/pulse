/**
 * Recurrence engine — virtual instances from RRULE.
 *
 * Rule of thumb: a recurring task is ONE template row in the `tasks` table.
 * That row carries `recurrence_rule` (an RRULE string). For any visible date
 * window we expand the RRULE into virtual instances on the fly. A virtual
 * instance is NOT a row in the database — it's a computed object with a
 * synthetic ID `${templateId}:${YYYY-MM-DD}`. When the user completes, edits,
 * or skips a virtual instance, we materialize it as a real row whose
 * `recurrence_parent_id` points back to the template.
 *
 * This file is the pure expander. The mutation that materializes an
 * exception lives next to the other task mutations.
 */

import { RRule, rrulestr } from "rrule";
import type { Task } from "./types";

export interface VirtualTask extends Task {
  /** Stable synthetic id for virtual instances: `${templateId}:${ymd}` */
  id: string;
  /** True when this row came from RRULE expansion, not the DB. */
  virtual: boolean;
  /** Backreference to the template row (also encoded in the synthetic id). */
  template_id: string | null;
  /** The instance date (start of that day, in user's TZ). */
  occurs_on: string;
}

export interface Window {
  /** Inclusive start of the window. */
  start: Date;
  /** Inclusive end of the window. */
  end: Date;
}

/**
 * Expand a list of tasks into instances visible in [start, end].
 *
 * Behavior:
 * - Tasks with no `recurrence_rule` are passed through as-is (one VirtualTask
 *   marked virtual:false) if they intersect the window via start_at or due_at.
 * - Tasks WITH a `recurrence_rule` (templates) are expanded. The template row
 *   itself is hidden from output (it represents the rule, not an instance).
 * - Exception rows (recurrence_parent_id set) replace the virtual instance for
 *   the same date — keyed by YYYY-MM-DD of the materialized row's date.
 */
export function expandRecurrences(tasks: Task[], range: Window): VirtualTask[] {
  const out: VirtualTask[] = [];

  // Index materialized exceptions by template_id + ymd so we can suppress
  // the virtual instance that would have rendered on that day.
  const exceptions = new Map<string, Set<string>>();
  for (const t of tasks) {
    if (!t.recurrence_parent_id) continue;
    const day = pickInstanceDate(t);
    if (!day) continue;
    const key = t.recurrence_parent_id;
    if (!exceptions.has(key)) exceptions.set(key, new Set());
    exceptions.get(key)!.add(ymd(day));
  }

  for (const t of tasks) {
    // Skip templates (their virtual instances replace them).
    if (t.recurrence_rule && !t.recurrence_parent_id) {
      const tplStart = t.start_at ? new Date(t.start_at) : t.due_at ? new Date(t.due_at) : null;
      if (!tplStart) continue;
      try {
        const rule = parseRule(t.recurrence_rule, tplStart);
        const dates = rule.between(range.start, range.end, true);
        const suppressed = exceptions.get(t.id) ?? new Set();
        for (const d of dates) {
          const dayStamp = ymd(d);
          if (suppressed.has(dayStamp)) continue;
          out.push(synth(t, d));
        }
      } catch {
        // Bad rule — render as a one-off on the original date so user can fix.
        out.push(synth(t, tplStart));
      }
      continue;
    }

    // Non-recurring or materialized-exception rows: include if in window.
    const anchor = t.start_at ? new Date(t.start_at) : t.due_at ? new Date(t.due_at) : null;
    if (!anchor) continue;
    if (anchor >= startOfDay(range.start) && anchor <= endOfDay(range.end)) {
      out.push({
        ...t,
        virtual: false,
        template_id: t.recurrence_parent_id ?? null,
        occurs_on: anchor.toISOString(),
      });
    }
  }

  // Sort by anchor time so the calendar/upcoming views can stream them.
  out.sort((a, b) => {
    const at = a.start_at ?? a.due_at ?? a.occurs_on;
    const bt = b.start_at ?? b.due_at ?? b.occurs_on;
    return at.localeCompare(bt);
  });

  return out;
}

/**
 * Build a synthetic VirtualTask from a template + occurrence date.
 * Carries over duration, priority, tags, list — everything except the times.
 */
function synth(template: Task, occursAt: Date): VirtualTask {
  // If the template had a clock-time on start_at, preserve hours/minutes.
  let start: Date | null = null;
  if (template.start_at) {
    const base = new Date(template.start_at);
    start = new Date(occursAt);
    start.setHours(base.getHours(), base.getMinutes(), 0, 0);
  }
  let due: Date | null = null;
  if (template.due_at) {
    const base = new Date(template.due_at);
    due = new Date(occursAt);
    due.setHours(base.getHours(), base.getMinutes(), 0, 0);
  }

  return {
    ...template,
    id: `${template.id}:${ymd(occursAt)}`,
    virtual: true,
    template_id: template.id,
    start_at: start ? start.toISOString() : null,
    due_at: due ? due.toISOString() : null,
    completed_at: null, // virtual instances are always incomplete
    occurs_on: startOfDay(occursAt).toISOString(),
  };
}

function parseRule(rule: string, anchor: Date): RRule {
  // rrule lib accepts both `RRULE:FREQ=...` and `FREQ=...`. Normalize.
  const s = rule.trim().startsWith("RRULE:") ? rule.trim() : `RRULE:${rule.trim()}`;
  const r = rrulestr(s, { dtstart: anchor });
  if (r instanceof RRule) return r;
  // RRuleSet — for v1 we only support single RRULEs.
  return new RRule({ ...(r as unknown as { origOptions: Record<string, unknown> }).origOptions, dtstart: anchor });
}

function pickInstanceDate(t: Task): Date | null {
  // For materialized exceptions, start_at wins, else due_at.
  if (t.start_at) return new Date(t.start_at);
  if (t.due_at) return new Date(t.due_at);
  return null;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ------------------------------------------------------------------ */
/* Preset RRULE strings the editor uses                                */
/* ------------------------------------------------------------------ */

export const RECURRENCE_PRESETS = {
  none: null,
  daily: "FREQ=DAILY",
  weekdays: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  weekly: "FREQ=WEEKLY",
  monthly: "FREQ=MONTHLY",
  yearly: "FREQ=YEARLY",
} as const;

export type RecurrencePreset = keyof typeof RECURRENCE_PRESETS;

/**
 * Best-effort label of an RRULE for chip display in the task row.
 * Falls back to "Repeats" for anything custom.
 */
export function recurrenceLabel(rule: string | null | undefined): string | null {
  if (!rule) return null;
  const r = rule.toUpperCase();
  if (r.includes("FREQ=DAILY")) return "Daily";
  if (r.includes("BYDAY=MO,TU,WE,TH,FR") || r.includes("BYDAY=MO,TU,WE,TH,FR;")) return "Weekdays";
  if (r.includes("FREQ=WEEKLY")) return "Weekly";
  if (r.includes("FREQ=MONTHLY")) return "Monthly";
  if (r.includes("FREQ=YEARLY")) return "Yearly";
  return "Repeats";
}
