"use client";

import { useCallback, useRef } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useUi } from "@/lib/ui/store";
import { isTypingTarget, useGlobalKey } from "@/lib/ui/shortcuts";

/**
 * Global keyboard router. Mount once at the app-shell level.
 *
 *   n         open quick-add
 *   ?         toggle shortcut overlay
 *   /         focus search (placeholder — wired in M2)
 *   esc       close quick-add / shortcut overlay
 *   g then    i | t | u | h | c | f | s   jump to view
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const { openQuickAdd, closeQuickAdd, quickAddOpen, shortcutsOpen, setShortcutsOpen } = useUi();
  const gArmed = useRef<{ at: number } | null>(null);

  const handle = useCallback(
    (e: KeyboardEvent) => {
      const typing = isTypingTarget(e.target);

      // Escape always wins.
      if (e.key === "Escape") {
        if (quickAddOpen) {
          closeQuickAdd();
          e.preventDefault();
          return;
        }
        if (shortcutsOpen) {
          setShortcutsOpen(false);
          e.preventDefault();
          return;
        }
      }

      // Things below are blocked while typing.
      if (typing || e.metaKey || e.ctrlKey || e.altKey) {
        gArmed.current = null;
        return;
      }

      // g-prefix sequences
      if (gArmed.current && Date.now() - gArmed.current.at < 1500) {
        const target = navTarget(e.key);
        gArmed.current = null;
        if (target) {
          router.push(target);
          e.preventDefault();
          return;
        }
      }
      if (e.key === "g") {
        gArmed.current = { at: Date.now() };
        return;
      }

      switch (e.key) {
        case "n":
          openQuickAdd();
          e.preventDefault();
          return;
        case "?":
          setShortcutsOpen(!shortcutsOpen);
          e.preventDefault();
          return;
      }
    },
    [router, openQuickAdd, closeQuickAdd, quickAddOpen, shortcutsOpen, setShortcutsOpen]
  );

  useGlobalKey(handle);
  return null;
}

function navTarget(key: string): Route | null {
  switch (key.toLowerCase()) {
    case "i":
      return "/inbox";
    case "t":
      return "/today";
    case "u":
      return "/upcoming";
    case "h":
      return "/habits";
    case "c":
      return "/calendar";
    case "f":
      return "/focus";
    case "s":
      return "/settings";
    default:
      return null;
  }
}
