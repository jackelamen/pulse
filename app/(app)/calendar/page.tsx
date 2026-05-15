import { CalendarClient } from "./calendar-client";

export const metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-7xl flex-col px-3 py-4 md:h-[100dvh] md:py-6">
      <CalendarClient />
    </div>
  );
}
