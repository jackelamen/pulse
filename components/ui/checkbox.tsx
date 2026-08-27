"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  priority?: 0 | 1 | 2 | 3;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

/**
 * Pulse circular checkbox.
 *
 * Priority is signalled while the task is OPEN and released once it is done.
 * Previously the completed fill was keyed to priority, and priority 0 filled
 * with `bg-foreground` -- so a finished low-priority task rendered as the
 * heaviest, blackest dot in the list while a finished high-priority one was a
 * softer rose. That inverted the weight it was trying to communicate, and made
 * completed work compete with the open work above it. Done tasks now recede
 * uniformly; the priority hue lives in the open-state ring, where it can still
 * be acted on.
 */
export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked, onCheckedChange, priority = 0, size = "md", className, ...rest }, ref) => {
    const dim = size === "sm" ? "h-4 w-4" : "h-5 w-5";
    const ring =
      priority === 3
        ? "border-rose-500 hover:border-rose-600"
        : priority === 2
          ? "border-amber-500 hover:border-amber-600"
          : priority === 1
            ? "border-sky-500 hover:border-sky-600"
            : "border-muted-foreground/55 hover:border-foreground/70";

    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={(e) => {
          e.stopPropagation();
          onCheckedChange(!checked);
        }}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-150",
          dim,
          checked
            ? "animate-task-complete border-muted-foreground/50 bg-muted-foreground/50"
            : cn(ring, "bg-card"),
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          className
        )}
        {...rest}
      >
        {checked && (
          <Check className="h-3 w-3 animate-check-in text-card" strokeWidth={3.5} />
        )}
      </button>
    );
  }
);
Checkbox.displayName = "Checkbox";
