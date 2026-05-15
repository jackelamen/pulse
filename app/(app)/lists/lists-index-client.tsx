"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLists, useCreateList } from "@/lib/lists/queries";

export function ListsIndexClient() {
  const { data, isLoading } = useLists();
  const create = useCreateList();
  const [name, setName] = useState("");

  return (
    <div className="space-y-5">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await create.mutateAsync({ name: name.trim() });
          setName("");
        }}
        className="pulse-pane flex items-center gap-2 px-3 py-2"
      >
        <Plus className="h-4 w-4 text-muted-foreground" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project name"
          className="flex-1 border-0 bg-transparent text-sm outline-none"
        />
        <Button type="submit" size="sm" variant={name.trim() ? "default" : "ghost"} disabled={!name.trim()}>
          Create
        </Button>
      </form>

      {isLoading ? (
        <div className="px-3 py-6 text-sm text-muted-foreground">Loading...</div>
      ) : (data ?? []).length === 0 ? (
        <div className="pulse-pane px-6 py-10 text-center text-sm text-muted-foreground">
          No projects yet. Create one above.
        </div>
      ) : (
        <ul className="space-y-1">
          {data!.map((l) => (
            <li key={l.id}>
              <Link
                href={`/projects/${l.id}`}
                className="pulse-row group"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: l.color || "#6b7280" }}
                />
                <span className="flex-1 truncate text-sm">{l.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
