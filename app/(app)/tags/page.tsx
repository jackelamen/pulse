import { TagsIndexClient } from "./tags-index-client";

export const metadata = { title: "Tags" };

export default function TagsPage() {
  return (
    <div className="pulse-page">
      <header className="mb-6">
        <h1 className="pulse-title">Tags</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every tag you&apos;ve used, with task counts.
        </p>
      </header>
      <TagsIndexClient />
    </div>
  );
}
