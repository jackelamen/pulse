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
 * Pulse circular checkbox. The border color reflects priority (subtle, not loud)
 * and on complete it fills with the priority color and shows a check.
 */
export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked, onCheckedChange, priority = 0, size = "md", className, ...rest }, ref) => {
    const dim = size === "sm" ? "h-4 w-4" : "h-5 w-5";
    const ring =
      priority === 3
        ? "border-rose-400"
        : priority === 2
          ? "border-amber-400"
          : priority === 1
            ? "border-sky-400"
            : "border-muted-foreground/40";
    const fill =
      priority === 3
        ? "bg-rose-500 border-rose-500"
        : priority === 2
          ? "bg-amber-500 border-amber-500"
          : priority === 1
            ? "bg-sky-500 border-sky-500"
            : "bg-foreground border-foreground";

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
          "inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
          dim,
          checked ? fill : ring,
          "bg-card shadow-[inset_0_0_0_2px_rgba(255,255,255,0.25)] hover:border-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          className
        )}
        {...rest}
      >
        {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </button>
    );
  }
);
Checkbox.displayName = "Checkbox";
