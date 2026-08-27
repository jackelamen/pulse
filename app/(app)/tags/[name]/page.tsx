import { TagDetailClient } from "./tag-detail-client";

export const dynamic = "force-dynamic";

export default function TagDetailPage({ params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name);
  return (
    <div className="pulse-page">
      <header className="mb-5">
        <p className="pulse-eyebrow">Tag</p>
        <h1 className="pulse-title">
          #{name}
        </h1>
      </header>
      <TagDetailClient tag={name} />
    </div>
  );
}
