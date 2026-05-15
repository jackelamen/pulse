import { UpcomingClient } from "./upcoming-client";

export const metadata = { title: "Upcoming" };

export default function UpcomingPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 md:py-10">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Upcoming</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Next 30 days. Drag tasks between days, or use quick-add.
        </p>
      </header>
      <UpcomingClient />
    </div>
  );
}
