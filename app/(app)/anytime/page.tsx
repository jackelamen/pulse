import { AnytimeClient } from "./anytime-client";

export const metadata = { title: "Anytime" };

export default function AnytimePage() {
  return (
    <div className="pulse-page">
      <header className="mb-6">
        <h1 className="pulse-title">
          Anytime
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Active tasks with no start time or due date.
        </p>
      </header>
      <AnytimeClient />
    </div>
  );
}
