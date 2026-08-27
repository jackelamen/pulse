import { HabitsClient } from "./habits-client";

export const metadata = { title: "Habits" };

export default function HabitsPage() {
  return (
    <div className="pulse-page-wide">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Daily rhythm
          </p>
          <h1 className="pulse-title">
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
