import * as workspaceRepository from "./workspace.repository";
import type { WorkspacePageRow } from "./workspace.repository";

async function siblingCount(parentId: string | null): Promise<number> {
  const all = await workspaceRepository.findAll();
  return all.filter((p) => p.parent_id === parentId).length;
}

function collectDescendantIds(pages: WorkspacePageRow[], rootId: string): string[] {
  const ids: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const current = stack.pop()!;
    ids.push(current);
    for (const p of pages) {
      if (p.parent_id === current) stack.push(p.id);
    }
  }
  return ids;
}

export async function listPagesService() {
  return workspaceRepository.findAll();
}

export async function createPageService(
  input: { id: string; parentId: string | null; title?: string; icon?: string },
  updatedBy: string,
) {
  const order = await siblingCount(input.parentId);
  return workspaceRepository.insert({ ...input, order, updatedBy });
}

export async function duplicatePageService(id: string, newId: string, updatedBy: string) {
  const source = await workspaceRepository.findById(id);
  if (!source) throw new Error("Página não encontrada.");
  const order = await siblingCount(source.parent_id);
  return workspaceRepository.insertCopy(newId, source, order, updatedBy);
}

export async function updateMetaService(
  id: string,
  patch: { icon?: string; title?: string; description?: string; linkedBoardId?: string | null },
  updatedBy: string,
) {
  return workspaceRepository.updateMeta(id, patch, updatedBy);
}

export async function updateBlocksService(id: string, blocks: Record<string, unknown>[], updatedBy: string) {
  return workspaceRepository.updateBlocks(id, blocks, updatedBy);
}

export async function setFavoriteService(id: string, favorite: boolean) {
  return workspaceRepository.setFavorite(id, favorite);
}

export async function movePageService(id: string, newParentId: string | null) {
  if (id === newParentId) throw new Error("Uma página não pode ser movida pra dentro dela mesma.");

  const all = await workspaceRepository.findAll();
  if (newParentId && collectDescendantIds(all, id).includes(newParentId)) {
    throw new Error("Não é possível mover uma página pra dentro de uma descendente dela.");
  }

  const order = all.filter((p) => p.parent_id === newParentId && p.id !== id).length;
  return workspaceRepository.move(id, newParentId, order);
}

export async function reorderSiblingsService(orderedIds: string[]) {
  await workspaceRepository.reorder(orderedIds);
}

export async function deletePageService(id: string) {
  await workspaceRepository.remove(id);
}
