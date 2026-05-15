import { HabitsClient } from "./habits-client";

export const metadata = { title: "Habits" };

export default function HabitsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-7 md:py-10">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Daily rhythm
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Habits
          </h1>
        </div>
        <p className="max-w-md text-sm text-muted-foreground">
          Build visual streaks, keep today simple, and make routines feel worth returning to.
        </p>
      </header>
      <HabitsClient />
    </div>
  );
}
