"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Plus, Folder as FolderIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useLists,
  useFolders,
  useCreateList,
  useCreateFolder,
  useToggleFolder,
} from "@/lib/lists/queries";
import type { List } from "@/lib/lists/types";

export function SidebarLists() {
  const lists = useLists();
  const folders = useFolders();
  const createList = useCreateList();
  const createFolder = useCreateFolder();
  const toggleFolder = useToggleFolder();
  const path = usePathname();
  const [creatingList, setCreatingList] = useState<{ folderId: string | null } | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const allLists = lists.data ?? [];
  const allFolders = folders.data ?? [];

  const rootLists = allLists.filter((l) => !l.folder_id);
  const byFolder = new Map<string, List[]>();
  for (const l of allLists) {
    if (!l.folder_id) continue;
    const arr = byFolder.get(l.folder_id) ?? [];
    arr.push(l);
    byFolder.set(l.folder_id, arr);
  }

  return (
    <div className="px-2">
      <div className="flex items-center justify-between px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Projects</span>
        <div className="flex items-center gap-1">
          <button
            className="rounded p-0.5 text-muted-foreground hover:bg-card hover:text-foreground"
            aria-label="Add folder"
            onClick={() => setCreatingFolder(true)}
            title="New project group"
          >
            <FolderIcon className="h-3 w-3" />
          </button>
          <button
            className="rounded p-0.5 text-muted-foreground hover:bg-card hover:text-foreground"
            aria-label="Add project"
            onClick={() => setCreatingList({ folderId: null })}
            title="New project"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {allLists.length === 0 && allFolders.length === 0 && !creatingList && !creatingFolder && (
        <div className="px-3 py-2 text-xs text-muted-foreground">No projects yet</div>
      )}

      {/* Folders */}
      {allFolders.map((folder) => {
        const children = byFolder.get(folder.id) ?? [];
        return (
          <div key={folder.id} className="mb-1">
            <button
              onClick={() => toggleFolder.mutate(folder)}
              className="group flex w-full items-center gap-1.5 rounded-xl px-2 py-1.5 text-[12px] text-muted-foreground hover:bg-card hover:text-foreground"
            >
              <ChevronRight
                className={cn("h-3 w-3 transition-transform", !folder.collapsed && "rotate-90")}
              />
              <span className="truncate">{folder.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCreatingList({ folderId: folder.id });
                }}
                className="ml-auto rounded p-0.5 opacity-0 hover:bg-muted group-hover:opacity-100"
                aria-label="Add project to group"
              >
                <Plus className="h-3 w-3" />
              </button>
            </button>
            {!folder.collapsed && (
              <div className="space-y-0.5 pl-3">
                {children.map((l) => (
                  <SidebarListLink
                    key={l.id}
                    list={l}
                    active={path === `/projects/${l.id}` || path === `/lists/${l.id}`}
                  />
                ))}
                {creatingList?.folderId === folder.id && (
                  <InlineCreate
                    onCancel={() => setCreatingList(null)}
                    onSubmit={async (name) => {
                      await createList.mutateAsync({ name, folder_id: folder.id });
                      setCreatingList(null);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Root-level projects */}
      <div className="space-y-0.5">
        {rootLists.map((l) => (
          <SidebarListLink
            key={l.id}
            list={l}
            active={path === `/projects/${l.id}` || path === `/lists/${l.id}`}
          />
        ))}
        {creatingList?.folderId === null && (
          <InlineCreate
            onCancel={() => setCreatingList(null)}
            onSubmit={async (name) => {
              await createList.mutateAsync({ name });
              setCreatingList(null);
            }}
          />
        )}
      </div>

      {creatingFolder && (
        <InlineCreate
          placeholder="Folder name"
          onCancel={() => setCreatingFolder(false)}
          onSubmit={async (name) => {
            await createFolder.mutateAsync({ name });
            setCreatingFolder(false);
          }}
        />
      )}
    </div>
  );
}

function SidebarListLink({ list, active }: { list: List; active: boolean }) {
  const color = list.color || "#6b7280";
  return (
    <Link
      href={`/projects/${list.id}`}
      className={cn(
        "flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm transition-colors",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground"
      )}
    >
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="truncate">{list.name}</span>
    </Link>
  );
}

function InlineCreate({
  placeholder = "Project name",
  onSubmit,
  onCancel,
}: {
  placeholder?: string;
  onSubmit: (name: string) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [v, setV] = useState("");
  return (
    <input
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v.trim()) onSubmit(v.trim());
        else onCancel();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (v.trim()) onSubmit(v.trim());
          else onCancel();
        } else if (e.key === "Escape") {
          onCancel();
        }
      }}
      placeholder={placeholder}
      className="w-full rounded-xl border border-border bg-card px-2 py-1.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-ring"
    />
  );
}
