"use client";

import { useEffect, useRef, type RefObject } from "react";
import { minutesToPx } from "./calendar-grid";

/** Hour to rest on for a day that is not today, so the view opens on working hours. */
const DEFAULT_HOUR = 8;

/**
 * Fraction of the viewport left above the target time. Placing it a third of
 * the way down keeps the hour or two you just finished on screen for context,
 * rather than pinning the current time to the very top edge.
 */
const LEAD_IN = 0.3;

/** Frames to wait for the canvas to become scrollable before giving up. */
const MAX_FRAMES = 30;

/**
 * Position a 24-hour calendar canvas on the part of the day worth looking at.
 *
 * Without this the canvas opens at midnight and every view starts on a screen
 * of empty night hours that has to be scrolled past.
 *
 * Deliberately keyed on `dayKey` alone: it fires when the view first mounts and
 * whenever the displayed day or week changes, and never in response to task
 * data arriving. Re-running on data would yank the canvas out from under
 * someone mid-scroll every time a query refetched.
 */
export function useInitialScroll(
  ref: RefObject<HTMLElement>,
  { dayKey, showsToday }: { dayKey: string; showsToday: boolean }
) {
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!ref.current || lastKey.current === dayKey) return;

    let frame = 0;
    let frames = 0;

    const apply = () => {
      const el = ref.current;
      if (!el) return;

      /*
       * On mount the effect can run before the hour canvas has been laid out.
       * While the element is not yet taller than its viewport the browser
       * clamps any scrollTop back to 0, so setting it here would silently do
       * nothing -- and marking the day as positioned would stop us retrying.
       * Wait for a frame where the value can actually stick.
       */
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 0) {
        if (frames++ < MAX_FRAMES) frame = requestAnimationFrame(apply);
        return;
      }

      lastKey.current = dayKey;

      const now = new Date();
      const minutes = showsToday
        ? now.getHours() * 60 + now.getMinutes()
        : DEFAULT_HOUR * 60;

      const target = minutesToPx(minutes) - el.clientHeight * LEAD_IN;
      el.scrollTop = Math.max(0, Math.min(target, maxScroll));
    };

    frame = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(frame);
  }, [ref, dayKey, showsToday]);
}
