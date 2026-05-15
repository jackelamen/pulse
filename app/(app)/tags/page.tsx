import { TagsIndexClient } from "./tags-index-client";

export const metadata = { title: "Tags" };

export default function TagsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:py-10">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Tags</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every tag you&apos;ve used, with task counts.
        </p>
      </header>
      <TagsIndexClient />
    </div>
  );
}
