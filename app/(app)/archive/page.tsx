import { ArchiveClient } from "./archive-client";

export const metadata = { title: "Archive" };

export default function ArchivePage() {
  return (
    <div className="pulse-page">
      <header className="mb-6">
        <h1 className="pulse-title">
          Archive
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tasks you&apos;ve put away. Restore them to active, or delete them for good.
        </p>
      </header>
      <ArchiveClient />
    </div>
  );
}
