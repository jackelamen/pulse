"use client";

import { useEffect } from "react";

/**
 * isTypingTarget — true when keystrokes should NOT trigger global shortcuts
 * (the user is in an input/textarea/contenteditable).
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

type Handler = (e: KeyboardEvent) => void;

/**
 * Register a single global keydown listener. Caller decides what to do with
 * each event. We expose a tiny matcher so call sites stay readable.
 */
export function useGlobalKey(handler: Handler) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      handler(e);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler]);
}

/**
 * Match modifier-bare letter shortcut. Returns true when key matches AND no
 * modifier keys are held AND the user is not typing into a form field.
 */
export function matchKey(e: KeyboardEvent, key: string): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  if (e.key.toLowerCase() !== key.toLowerCase()) return false;
  if (isTypingTarget(e.target)) return false;
  return true;
}
