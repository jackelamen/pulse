/**
 * Shared geometry for the day/week views.
 *
 * Calendar canvas is a vertical strip of 24 hour bands. Each band is split
 * into 4 fifteen-minute slots (96 slots total per day). All time math goes
 * through these constants so drag math stays consistent.
 */
export const SLOT_MINUTES = 15;
export const SLOTS_PER_HOUR = 60 / SLOT_MINUTES;
export const SLOTS_PER_DAY = 24 * SLOTS_PER_HOUR; // 96
export const SLOT_PX = 12; // 12px per 15-min slot = 48px/hour
export const HOUR_PX = SLOT_PX * SLOTS_PER_HOUR;

/** Convert "minutes since midnight" → vertical pixel offset. */
export function minutesToPx(min: number): number {
  return (min / SLOT_MINUTES) * SLOT_PX;
}

/** Snap a minute count to the nearest slot. */
export function snapMinutes(min: number): number {
  return Math.round(min / SLOT_MINUTES) * SLOT_MINUTES;
}
