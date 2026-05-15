"use client";

import { useEffect } from "react";
import { useUi } from "@/lib/ui/store";
import { QuickAdd } from "./quick-add";

/**
 * Floating quick-add. Triggered globally by `n`. Closes on Escape or after submit.
 */
export function QuickAddOverlay() {
  const { quickAddOpen, quickAddDefaultListId, closeQuickAdd } = useUi();

  useEffect(() => {
    if (!quickAddOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeQuickAdd();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quickAddOpen, closeQuickAdd]);

  if (!quickAddOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={closeQuickAdd}
      role="dialog"
      aria-modal="true"
      aria-label="Quick add task"
    >
      <div className="w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        <QuickAdd
          variant="overlay"
          autoFocus
          defaultListId={quickAddDefaultListId}
          onSubmitted={closeQuickAdd}
        />
        <p className="mt-2 text-center text-[11px] text-white/70">
          Try <span className="pulse-kbd">tomorrow 9am !high #work</span> · Esc to close
        </p>
      </div>
    </div>
  );
}
