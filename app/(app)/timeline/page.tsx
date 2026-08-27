import { TimelineClient } from "./timeline-client";

export const metadata = { title: "Timeline View" };

export default function TimelinePage() {
  return (
    <div className="pulse-page-wide">
      <header className="mb-7">
        <p className="pulse-eyebrow">Today</p>
        <h1 className="pulse-title">
          Timeline View
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          A focused chronological view of today&apos;s timed tasks.
        </p>
      </header>
      <TimelineClient />
    </div>
  );
}
