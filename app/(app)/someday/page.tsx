import { SomedayClient } from "./someday-client";

export const metadata = { title: "Someday" };

export default function SomedayPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:py-12">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Someday
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Park ideas and maybe-later tasks without putting them in the active flow.
        </p>
      </header>
      <SomedayClient />
    </div>
  );
}
