import { InboxClient } from "./inbox-client";

export const metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <div className="pulse-page">
      <header className="mb-6">
        <h1 className="pulse-title">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop it here. Triage later.
        </p>
      </header>
      <InboxClient />
    </div>
  );
}
