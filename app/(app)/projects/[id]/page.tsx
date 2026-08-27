import { ListClient } from "../../lists/[id]/list-client";

export const dynamic = "force-dynamic";

export default function ProjectPage({ params }: { params: { id: string } }) {
  return (
    <div className="pulse-page">
      <ListClient listId={params.id} />
    </div>
  );
}
