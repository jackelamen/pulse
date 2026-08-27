import { LogbookClient } from "./logbook-client";

export const metadata = { title: "Logbook" };

export default function LogbookPage() {
  return (
    <div className="pulse-page">
      <header className="mb-6">
        <h1 className="pulse-title">
          Logbook
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A record of tasks, habits, and focus sessions you actually finished.
        </p>
      </header>
      <LogbookClient />
    </div>
  );
}
