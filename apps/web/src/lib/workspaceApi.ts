import { request } from "@/lib/api";
import type { Block, WorkspacePage } from "@/lib/workspaceTypes";

interface WorkspacePageRow {
  id: string;
  parent_id: string | null;
  icon: string;
  title: string;
  description: string;
  favorite: boolean;
  order: number;
  blocks: Block[];
  linked_board_id: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string;
}

function fromRow(row: WorkspacePageRow): WorkspacePage {
  return {
    id: row.id,
    parentId: row.parent_id,
    icon: row.icon,
    title: row.title,
    description: row.description,
    favorite: row.favorite,
    order: row.order,
    blocks: row.blocks,
    linkedBoardId: row.linked_board_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

export async function listWorkspacePages(): Promise<WorkspacePage[]> {
  const rows = await request<WorkspacePageRow[]>("/workspace/pages");
  return rows.map(fromRow);
}

export async function createWorkspacePage(input: {
  id: string;
  parentId: string | null;
  title?: string;
  icon?: string;
}): Promise<WorkspacePage> {
  const row = await request<WorkspacePageRow>("/workspace/pages", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return fromRow(row);
}

export async function duplicateWorkspacePage(id: string, newId: string): Promise<WorkspacePage> {
  const row = await request<WorkspacePageRow>(`/workspace/pages/${id}/duplicate`, {
    method: "POST",
    body: JSON.stringify({ newId }),
  });
  return fromRow(row);
}

export async function updateWorkspacePageMeta(
  id: string,
  patch: { icon?: string; title?: string; description?: string; linkedBoardId?: string | null },
): Promise<WorkspacePage> {
  const row = await request<WorkspacePageRow>(`/workspace/pages/${id}/meta`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return fromRow(row);
}

export async function updateWorkspacePageBlocks(id: string, blocks: Block[]): Promise<WorkspacePage> {
  const row = await request<WorkspacePageRow>(`/workspace/pages/${id}/blocks`, {
    method: "PUT",
    body: JSON.stringify({ blocks }),
  });
  return fromRow(row);
}

export async function setWorkspacePageFavorite(id: string, favorite: boolean): Promise<WorkspacePage> {
  const row = await request<WorkspacePageRow>(`/workspace/pages/${id}/favorite`, {
    method: "POST",
    body: JSON.stringify({ favorite }),
  });
  return fromRow(row);
}

export async function moveWorkspacePage(id: string, parentId: string | null): Promise<WorkspacePage> {
  const row = await request<WorkspacePageRow>(`/workspace/pages/${id}/move`, {
    method: "PATCH",
    body: JSON.stringify({ parentId }),
  });
  return fromRow(row);
}

export async function reorderWorkspaceSiblings(orderedIds: string[]): Promise<void> {
  await request("/workspace/pages/reorder", {
    method: "PATCH",
    body: JSON.stringify({ orderedIds }),
  });
}

export async function deleteWorkspacePage(id: string): Promise<void> {
  await request(`/workspace/pages/${id}`, { method: "DELETE" });
}
