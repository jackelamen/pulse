import { TimelineClient } from "./timeline-client";

export const metadata = { title: "Timeline View" };

export default function TimelinePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 md:py-10">
      <header className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
          Today
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
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
