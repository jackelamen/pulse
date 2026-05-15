import { ListClient } from "../../lists/[id]/list-client";

export const dynamic = "force-dynamic";

export default function ProjectPage({ params }: { params: { id: string } }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 md:py-10">
      <ListClient listId={params.id} />
    </div>
  );
}
