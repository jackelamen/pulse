"use client";

import { useEffect, useState } from "react";
import { formatDateLong } from "@/lib/utils";

type TodayHeaderState = {
  dateLabel: string;
  greeting: string;
};

export function TodayHeader({ firstName }: { firstName: string | null }) {
  const [header, setHeader] = useState<TodayHeaderState>({
    dateLabel: "",
    greeting: "Today",
  });

  useEffect(() => {
    const now = new Date();
    setHeader({
      dateLabel: formatDateLong(now),
      greeting: greetingFor(now),
    });
  }, []);

  return (
    <header className="mb-8">
      <p className="min-h-4 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
        {header.dateLabel}
      </p>
      <h1 className="mt-4 font-display text-4xl font-semibold leading-none tracking-tight text-foreground md:text-6xl">
        {header.greeting}
        {firstName && header.greeting !== "Today" ? `, ${firstName}` : ""}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
        Ready for the day? Here is your prioritized pulse.
      </p>
    </header>
  );
}

function greetingFor(d: Date) {
  const h = d.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
