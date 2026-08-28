import type { Priority } from "@/types/database";
import type { ParsedQuickAdd } from "./types";
import { RECURRENCE_PRESETS } from "./recurrence";

/**
 * Parse a quick-add string into title + structured fields.
 *
 * Supported patterns (all optional, in any order, anywhere in the string):
 *   priority    !high | !med | !low  |  !1 | !2 | !3  (3 = highest)
 *   tags        #work #home #deep-work
 *   project     ~launch  (matched against the caller's real project list --
 *               see `lists` below; an unrecognized ~token is left in the
 *               title untouched rather than silently eaten)
 *   recurrence  every day, every weekday(s), every week, every month,
 *               every year, every mon..sun (requires the "every" -- bare
 *               "daily"/"weekly"/etc are ordinary English words that show up
 *               in real task titles, e.g. "Read the Daily Digest")
 *   dates       today, tonight, tomorrow, tmrw, mon..sun,
 *               "next monday", "in 3 days", "in 2 weeks",
 *               optional clock time "9am", "9:30am", "15:00"
 *   duration    for 30m, for 1h, 45m, 1h30m
 *
 * Pure aside from resolving `~project` against the `lists` passed in --
 * unlike tags, projects are an existing set the app already knows, not
 * free text, so there is nothing to invent a slug for.
 * Returns a normalized title (tokens stripped, whitespace collapsed).
 */
export function parseQuickAdd(
  input: string,
  now: Date = new Date(),
  lists: Array<{ id: string; name: string }> = []
): ParsedQuickAdd {
  let title = input;
  let priority: Priority = 0;
  const tags = new Set<string>();
  let start_at: string | null = null;
  let due_at: string | null = null;
  let duration_minutes: number | null = null;
  let parsedTime: { h: number; m: number } | null = null;
  let list_id: string | null = null;
  let list_name: string | null = null;
  let recurrence_rule: string | null = null;

  // ---- priority ---------------------------------------------------
  title = title.replace(/(?:^|\s)!(high|med|medium|low|[1-3])(?=\s|$)/gi, (_match, raw) => {
    const v = String(raw).toLowerCase();
    if (v === "high" || v === "3") priority = 3;
    else if (v === "med" || v === "medium" || v === "2") priority = 2;
    else if (v === "low" || v === "1") priority = 1;
    return " ";
  });

  // ---- tags -------------------------------------------------------
  title = title.replace(/(?:^|\s)#([a-z0-9][a-z0-9-_]*)/gi, (_m, tag) => {
    tags.add(String(tag).toLowerCase());
    return " ";
  });

  // ---- project ------------------------------------------------------
  // `~slug` is matched against the caller's actual projects, not invented.
  // An exact slug match wins; failing that, a ~prefix that resolves to
  // exactly one project is accepted so short typing still works. A ~token
  // that matches nothing or matches more than one project is left in the
  // title -- eating it would silently discard whatever the person typed.
  const projectMatch = title.match(/(?:^|\s)~([a-z0-9][a-z0-9-]*)(?=\s|$)/i);
  if (projectMatch && lists.length > 0) {
    const typed = projectMatch[1].toLowerCase();
    const slugged = lists.map((l) => ({ ...l, slug: slugify(l.name) }));
    const exact = slugged.find((l) => l.slug === typed);
    const prefixMatches = exact ? [] : slugged.filter((l) => l.slug.startsWith(typed));
    const match = exact ?? (prefixMatches.length === 1 ? prefixMatches[0] : null);
    if (match) {
      list_id = match.id;
      list_name = match.name;
      title = title.replace(projectMatch[0], " ");
    }
  }

  // ---- recurrence -----------------------------------------------------
  // Requires the "every" -- see the doc comment above for why bare
  // "daily"/"weekly"/"monthly" aren't recognized on their own.
  const everyWeekday = title.match(
    /(?:^|\s)every\s+(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/i
  );
  if (everyWeekday) {
    const code = RRULE_WEEKDAY_CODES[everyWeekday[1].toLowerCase()];
    recurrence_rule = `FREQ=WEEKLY;BYDAY=${code}`;
    title = title.replace(everyWeekday[0], " ");
  } else {
    const everyFreq = title.match(/(?:^|\s)every\s+(day|weekday|weekdays|week|month|year)\b/i);
    if (everyFreq) {
      const unit = everyFreq[1].toLowerCase();
      recurrence_rule =
        unit === "day"
          ? RECURRENCE_PRESETS.daily
          : unit === "weekday" || unit === "weekdays"
            ? RECURRENCE_PRESETS.weekdays
            : unit === "week"
              ? RECURRENCE_PRESETS.weekly
              : unit === "month"
                ? RECURRENCE_PRESETS.monthly
                : RECURRENCE_PRESETS.yearly;
      title = title.replace(everyFreq[0], " ");
    }
  }

  // ---- duration ---------------------------------------------------
  title = title.replace(
    /(?:^|\s)(?:for\s+)?(?:(\d{1,2}(?:\.\d)?)\s*h(?:ours?)?)?\s*(?:(\d{1,3})\s*m(?:in(?:ute)?s?)?)?(?=\s|$)/gi,
    (match, hours, minutes) => {
      if (!hours && !minutes) return match;
      const h = hours ? Number.parseFloat(String(hours)) : 0;
      const m = minutes ? Number.parseInt(String(minutes), 10) : 0;
      const total = Math.round(h * 60 + m);
      if (total <= 0 || total > 24 * 60) return match;
      duration_minutes = total;
      return " ";
    }
  );

  // ---- clock time (capture, but apply only once we know the date) -
  // Match either 12h "9am", "9:30 pm" or 24h "15:00"
  const time12 = title.match(/(?:^|\s)(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (time12) {
    let h = parseInt(time12[1], 10);
    const m = time12[2] ? parseInt(time12[2], 10) : 0;
    const ap = time12[3].toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (h <= 23 && m <= 59) {
      parsedTime = { h, m };
      title = title.replace(time12[0], " ");
    }
  } else {
    const time24 = title.match(/(?:^|\s)(\d{1,2}):(\d{2})\b/);
    if (time24) {
      const h = parseInt(time24[1], 10);
      const m = parseInt(time24[2], 10);
      if (h <= 23 && m <= 59) {
        parsedTime = { h, m };
        title = title.replace(time24[0], " ");
      }
    }
  }

  // ---- dates ------------------------------------------------------
  // Order matters: longer / more specific patterns first.
  const dayMap: Record<string, number> = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tues: 2,
    tuesday: 2,
    wed: 3,
    weds: 3,
    wednesday: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
  };

  let dueDate: Date | null = null;

  const inN = title.match(/(?:^|\s)in\s+(\d{1,3})\s+(day|days|week|weeks)\b/i);
  if (inN) {
    const n = parseInt(inN[1], 10);
    const unit = inN[2].toLowerCase();
    const d = startOfDay(now);
    d.setDate(d.getDate() + (unit.startsWith("week") ? n * 7 : n));
    dueDate = d;
    title = title.replace(inN[0], " ");
  }

  if (!dueDate) {
    const nextDay = title.match(/(?:^|\s)next\s+(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/i);
    if (nextDay) {
      const target = dayMap[nextDay[1].toLowerCase()];
      dueDate = nextWeekday(now, target);
      title = title.replace(nextDay[0], " ");
    }
  }

  if (!dueDate) {
    const tonight = title.match(/(?:^|\s)tonight\b/i);
    if (tonight) {
      dueDate = startOfDay(now);
      if (!parsedTime) parsedTime = { h: 20, m: 0 };
      title = title.replace(tonight[0], " ");
    }
  }

  if (!dueDate) {
    const today = title.match(/(?:^|\s)today\b/i);
    if (today) {
      dueDate = startOfDay(now);
      title = title.replace(today[0], " ");
    }
  }

  if (!dueDate) {
    const tomorrow = title.match(/(?:^|\s)(tomorrow|tmrw|tmw)\b/i);
    if (tomorrow) {
      const d = startOfDay(now);
      d.setDate(d.getDate() + 1);
      dueDate = d;
      title = title.replace(tomorrow[0], " ");
    }
  }

  if (!dueDate) {
    // Bare weekday → upcoming occurrence (today if it's today and no time has passed, else next)
    const bareDay = title.match(/(?:^|\s)(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/i);
    if (bareDay) {
      const target = dayMap[bareDay[1].toLowerCase()];
      dueDate = upcomingWeekday(now, target);
      title = title.replace(bareDay[0], " ");
    }
  }

  if (dueDate) {
    if (parsedTime) {
      dueDate.setHours(parsedTime.h, parsedTime.m, 0, 0);
      start_at = dueDate.toISOString();
    } else {
      due_at = dueDate.toISOString();
    }
  } else if (parsedTime) {
    // Time given but no date → assume today
    const d = startOfDay(now);
    d.setHours(parsedTime.h, parsedTime.m, 0, 0);
    start_at = d.toISOString();
  }

  // A recurring task with no anchor date is invisible everywhere -- the
  // expander needs a start date to build the RRULE from and silently skips
  // any template that has neither start_at nor due_at. "every mon" with no
  // other date/time in the string would otherwise create a task that never
  // shows up again, with nothing telling the person why.
  if (recurrence_rule && !start_at && !due_at) {
    due_at = startOfDay(now).toISOString();
  }

  // ---- clean up ---------------------------------------------------
  title = title.replace(/\s+/g, " ").trim();

  return {
    title,
    start_at,
    due_at,
    duration_minutes,
    priority,
    tags: Array.from(tags),
    list_id,
    list_name,
    recurrence_rule,
  };
}

/* helpers */

/** MO/TU/.../SU in `dayMap` order (0=Sun..6=Sat), for building BYDAY. */
const RRULE_WEEKDAY_CODES: Record<string, string> = {
  sun: "SU",
  sunday: "SU",
  mon: "MO",
  monday: "MO",
  tue: "TU",
  tues: "TU",
  tuesday: "TU",
  wed: "WE",
  weds: "WE",
  wednesday: "WE",
  thu: "TH",
  thur: "TH",
  thurs: "TH",
  thursday: "TH",
  fri: "FR",
  friday: "FR",
  sat: "SA",
  saturday: "SA",
};

/** Lowercase, non-alphanumeric runs -> single hyphen, trimmed -- for comparing a typed ~slug against a project's display name. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function upcomingWeekday(now: Date, target: number) {
  const d = startOfDay(now);
  const diff = (target - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function nextWeekday(now: Date, target: number) {
  const d = startOfDay(now);
  const diff = (target - d.getDay() + 7) % 7 || 7; // always at least 1 week out
  d.setDate(d.getDate() + diff);
  return d;
}
