"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { List, ListInsert, ListUpdate, Folder, FolderInsert, Tag } from "./types";

const supabase = () => createClient();

export const listKeys = {
  all: ["lists"] as const,
  one: (id: string) => ["lists", id] as const,
};

export const folderKeys = {
  all: ["folders"] as const,
};

export const tagKeys = {
  all: ["tags"] as const,
};

/* ---------------- lists ---------------- */

export function useLists() {
  return useQuery({
    queryKey: listKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("lists")
        .select("*")
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as List[];
    },
  });
}

export function useList(id: string | undefined) {
  return useQuery({
    queryKey: id ? listKeys.one(id) : ["lists", "noop"],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("lists")
        .select("*")
        .eq("id", id!)
        .is("deleted_at", null)
        .single();
      if (error) throw error;
      return data as List;
    },
  });
}

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ListInsert) => {
      const { data, error } = await supabase().from("lists").insert(input).select().single();
      if (error) throw error;
      return data as List;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: listKeys.all }),
  });
}

export function useUpdateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ListUpdate }) => {
      const { data, error } = await supabase()
        .from("lists")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as List;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: listKeys.all }),
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error: taskError } = await supabase()
        .from("tasks")
        .update({ list_id: null })
        .eq("list_id", id)
        .is("deleted_at", null);
      if (taskError) throw taskError;

      const { error } = await supabase()
        .from("lists")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: listKeys.all });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

/* ---------------- folders ---------------- */

export function useFolders() {
  return useQuery({
    queryKey: folderKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("folders")
        .select("*")
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Folder[];
    },
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FolderInsert) => {
      const { data, error } = await supabase().from("folders").insert(input).select().single();
      if (error) throw error;
      return data as Folder;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: folderKeys.all }),
  });
}

export function useToggleFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (folder: Folder) => {
      const { data, error } = await supabase()
        .from("folders")
        .update({ collapsed: !folder.collapsed })
        .eq("id", folder.id)
        .select()
        .single();
      if (error) throw error;
      return data as Folder;
    },
    onMutate: async (folder) => {
      await qc.cancelQueries({ queryKey: folderKeys.all });
      const prev = qc.getQueryData<Folder[]>(folderKeys.all);
      qc.setQueryData<Folder[]>(folderKeys.all, (old) =>
        (old ?? []).map((f) => (f.id === folder.id ? { ...f, collapsed: !f.collapsed } : f))
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(folderKeys.all, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: folderKeys.all }),
  });
}

/* ---------------- tags ---------------- */

export function useTags() {
  return useQuery({
    queryKey: tagKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("tags")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Tag[];
    },
  });
}

export function useUpsertTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: string | null }) => {
      const { data, error } = await supabase()
        .from("tags")
        .upsert({ name: input.name.toLowerCase(), color: input.color ?? null }, { onConflict: "user_id,name" })
        .select()
        .single();
      if (error) throw error;
      return data as Tag;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tagKeys.all }),
  });
}

export function useRenameTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const from = normalizeTagName(oldName);
      const to = normalizeTagName(newName);
      if (!from || !to) throw new Error("Tag names cannot be blank.");
      if (from === to) return { oldName: from, newName: to };

      const client = supabase();
      const { data: taskRows, error: taskReadError } = await client
        .from("tasks")
        .select("id,tags")
        .contains("tags", [from])
        .is("deleted_at", null);
      if (taskReadError) throw taskReadError;

      const { data: existingTag } = await client
        .from("tags")
        .select("color")
        .eq("name", from)
        .maybeSingle();

      const { error: upsertError } = await client
        .from("tags")
        .upsert(
          { name: to, color: existingTag?.color ?? null },
          { onConflict: "user_id,name" }
        );
      if (upsertError) throw upsertError;

      const updates = ((taskRows ?? []) as Array<{ id: string; tags: string[] | null }>).map(
        (task) => {
          const nextTags = Array.from(
            new Set((task.tags ?? []).map((tag) => (tag === from ? to : tag)))
          );
          return client.from("tasks").update({ tags: nextTags }).eq("id", task.id);
        }
      );
      const results = await Promise.all(updates);
      const taskUpdateError = results.find((result) => result.error)?.error;
      if (taskUpdateError) throw taskUpdateError;

      const { error: deleteOldError } = await client.from("tags").delete().eq("name", from);
      if (deleteOldError) throw deleteOldError;

      return { oldName: from, newName: to };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tagKeys.all });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const tagName = normalizeTagName(name);
      if (!tagName) throw new Error("Tag name cannot be blank.");

      const client = supabase();
      const { data: taskRows, error: taskReadError } = await client
        .from("tasks")
        .select("id,tags")
        .contains("tags", [tagName])
        .is("deleted_at", null);
      if (taskReadError) throw taskReadError;

      const updates = ((taskRows ?? []) as Array<{ id: string; tags: string[] | null }>).map(
        (task) =>
          client
            .from("tasks")
            .update({ tags: (task.tags ?? []).filter((tag) => tag !== tagName) })
            .eq("id", task.id)
      );
      const results = await Promise.all(updates);
      const taskUpdateError = results.find((result) => result.error)?.error;
      if (taskUpdateError) throw taskUpdateError;

      const { error: deleteError } = await client.from("tags").delete().eq("name", tagName);
      if (deleteError) throw deleteError;

      return tagName;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tagKeys.all });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

function normalizeTagName(name: string) {
  return name.trim().replace(/^#/, "").toLowerCase();
}
