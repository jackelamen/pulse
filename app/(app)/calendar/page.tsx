import { CalendarClient } from "./calendar-client";

export const metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <div className="pulse-page-wide flex h-[calc(100dvh-4rem)] flex-col md:h-[100dvh]">
      <CalendarClient />
    </div>
  );
}
