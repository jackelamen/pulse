"use client";

import { create } from "zustand";

export type CalendarMode = "day" | "week" | "month";

interface CalendarState {
  mode: CalendarMode;
  anchor: string; // ISO of the focused day
  setMode: (m: CalendarMode) => void;
  setAnchor: (d: Date) => void;
}

export const useCalendar = create<CalendarState>((set) => ({
  mode: "week",
  anchor: new Date().toISOString(),
  setMode: (m) => set({ mode: m }),
  setAnchor: (d) => set({ anchor: d.toISOString() }),
}));
