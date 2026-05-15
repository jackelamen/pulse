import { LogbookClient } from "./logbook-client";

export const metadata = { title: "Logbook" };

export default function LogbookPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 md:py-12">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
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
