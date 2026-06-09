import { ArchiveClient } from "./archive-client";

export const metadata = { title: "Archive" };

export default function ArchivePage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 md:py-12">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
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
