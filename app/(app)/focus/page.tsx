import { FocusClient } from "./focus-client";

export const metadata = { title: "Focus" };

export default function FocusPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-8 md:py-12">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">Pomodoro, flow, and distraction logging</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Focus
        </h1>
      </header>
      <FocusClient />
    </div>
  );
}
