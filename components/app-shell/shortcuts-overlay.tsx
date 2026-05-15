"use client";

import { useUi } from "@/lib/ui/store";

const ROWS: Array<[string, string]> = [
  ["n", "Quick add"],
  ["⌘ K", "Search & commands (M2)"],
  ["g i", "Inbox"],
  ["g t", "Today"],
  ["g u", "Upcoming"],
  ["g h", "Habits"],
  ["g c", "Calendar"],
  ["g f", "Focus"],
  ["g s", "Settings"],
  ["?", "Show this overlay"],
  ["Esc", "Close panels"],
];

export function ShortcutsOverlay() {
  const { shortcutsOpen, setShortcutsOpen } = useUi();
  if (!shortcutsOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={() => setShortcutsOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="pulse-pane w-full max-w-md p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-semibold">Keyboard shortcuts</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Most actions are reachable from the keyboard. Press <span className="pulse-kbd">Esc</span>{" "}
          to close.
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-y-1.5 sm:grid-cols-2 sm:gap-x-6">
          {ROWS.map(([key, label]) => (
            <li key={key} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="pulse-kbd">{key}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
