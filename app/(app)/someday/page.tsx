import { SomedayClient } from "./someday-client";

export const metadata = { title: "Someday" };

export default function SomedayPage() {
  return (
    <div className="pulse-page">
      <header className="mb-6">
        <h1 className="pulse-title">
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
