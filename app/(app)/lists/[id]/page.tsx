import { ListClient } from "./list-client";

export const dynamic = "force-dynamic";

export default function ListPage({ params }: { params: { id: string } }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 md:py-10">
      <ListClient listId={params.id} />
    </div>
  );
}
