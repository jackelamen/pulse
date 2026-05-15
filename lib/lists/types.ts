import type { Database } from "@/types/database";

export type List = Database["public"]["Tables"]["lists"]["Row"];
export type ListInsert = Database["public"]["Tables"]["lists"]["Insert"];
export type ListUpdate = Database["public"]["Tables"]["lists"]["Update"];

export type Folder = Database["public"]["Tables"]["folders"]["Row"];
export type FolderInsert = Database["public"]["Tables"]["folders"]["Insert"];

export type Tag = Database["public"]["Tables"]["tags"]["Row"];
export type TagInsert = Database["public"]["Tables"]["tags"]["Insert"];
