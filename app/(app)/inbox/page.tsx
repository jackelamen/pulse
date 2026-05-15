import { InboxClient } from "./inbox-client";

export const metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:py-12">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop it here. Triage later.
        </p>
      </header>
      <InboxClient />
    </div>
  );
}
