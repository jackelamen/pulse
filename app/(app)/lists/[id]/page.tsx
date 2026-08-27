import { ListClient } from "./list-client";

export const dynamic = "force-dynamic";

export default function ListPage({ params }: { params: { id: string } }) {
  return (
    <div className="pulse-page">
      <ListClient listId={params.id} />
    </div>
  );
}
