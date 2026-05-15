import { AnytimeClient } from "./anytime-client";

export const metadata = { title: "Anytime" };

export default function AnytimePage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:py-12">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
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
