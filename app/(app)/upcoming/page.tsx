import { UpcomingClient } from "./upcoming-client";

export const metadata = { title: "Upcoming" };

export default function UpcomingPage() {
  return (
    <div className="pulse-page">
      <header className="mb-6">
        <h1 className="pulse-title">Upcoming</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Next 30 days. Drag tasks between days, or use quick-add.
        </p>
      </header>
      <UpcomingClient />
    </div>
  );
}
