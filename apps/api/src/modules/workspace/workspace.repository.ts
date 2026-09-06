import { randomUUID } from "node:crypto";
import { getSupabase } from "../../lib/supabase";

export interface WorkspacePageRow {
  id: string;
  parent_id: string | null;
  icon: string;
  title: string;
  description: string;
  favorite: boolean;
  order: number;
  blocks: Record<string, unknown>[];
  linked_board_id: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string;
}

export async function findAll(): Promise<WorkspacePageRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("workspace_pages")
    .select("*")
    .order("order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function findById(id: string): Promise<WorkspacePageRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("workspace_pages").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function insert(input: {
  id: string;
  parentId: string | null;
  title?: string;
  icon?: string;
  order: number;
  updatedBy: string;
}): Promise<WorkspacePageRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("workspace_pages")
    .insert([
      {
        id: input.id,
        parent_id: input.parentId,
        title: input.title ?? "",
        icon: input.icon ?? "📄",
        order: input.order,
        blocks: [{ id: randomUUID(), type: "paragraph", content: "" }],
        updated_by: input.updatedBy,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function insertCopy(
  newId: string,
  source: WorkspacePageRow,
  order: number,
  updatedBy: string,
): Promise<WorkspacePageRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("workspace_pages")
    .insert([
      {
        id: newId,
        parent_id: source.parent_id,
        title: `${source.title} (cópia)`,
        icon: source.icon,
        description: source.description,
        order,
        blocks: source.blocks.map((block) => ({ ...block, id: randomUUID() })),
        updated_by: updatedBy,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateMeta(
  id: string,
  patch: { icon?: string; title?: string; description?: string; linkedBoardId?: string | null },
  updatedBy: string,
): Promise<WorkspacePageRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("workspace_pages")
    .update({
      ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.linkedBoardId !== undefined ? { linked_board_id: patch.linkedBoardId } : {}),
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateBlocks(
  id: string,
  blocks: Record<string, unknown>[],
  updatedBy: string,
): Promise<WorkspacePageRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("workspace_pages")
    .update({ blocks, updated_at: new Date().toISOString(), updated_by: updatedBy })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function setFavorite(id: string, favorite: boolean): Promise<WorkspacePageRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("workspace_pages")
    .update({ favorite })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function move(id: string, parentId: string | null, order: number): Promise<WorkspacePageRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("workspace_pages")
    .update({ parent_id: parentId, order, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function reorder(orderedIds: string[]): Promise<void> {
  const supabase = getSupabase();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("workspace_pages").update({ order: index }).eq("id", id),
    ),
  );
}

export async function remove(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("workspace_pages").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
