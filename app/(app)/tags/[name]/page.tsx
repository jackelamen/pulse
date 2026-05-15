import { TagDetailClient } from "./tag-detail-client";

export const dynamic = "force-dynamic";

export default function TagDetailPage({ params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name);
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:py-10">
      <header className="mb-5">
        <p className="text-sm text-muted-foreground">Tag</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          #{name}
        </h1>
      </header>
      <TagDetailClient tag={name} />
    </div>
  );
}
