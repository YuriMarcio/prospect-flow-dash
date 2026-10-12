import * as objectivesRepository from "./objectives.repository";

export async function listColumnsService() {
  return objectivesRepository.listColumns();
}

export async function createColumnService(title: string) {
  if (!title?.trim()) throw new Error("Informe um título para a coluna.");
  return objectivesRepository.createColumn(title.trim());
}

export async function updateColumnService(id: string, patch: { title?: string; color?: string; is_done?: boolean }) {
  return objectivesRepository.updateColumn(id, patch);
}

export async function reorderColumnsService(orderedIds: string[]) {
  await objectivesRepository.reorderColumns(orderedIds);
}

/** Ao excluir uma coluna, os cards dela migram pra primeira coluna restante — nunca somem junto. */
export async function deleteColumnService(id: string) {
  const columns = await objectivesRepository.listColumns();
  const remaining = columns.filter((c) => c.id !== id);
  if (remaining.length === 0) throw new Error("Não é possível excluir a única coluna do quadro.");

  const target = remaining[0];
  await objectivesRepository.reassignObjectives(id, target.id);
  await objectivesRepository.deleteColumn(id);
}

export async function listObjectivesService() {
  return objectivesRepository.findAll();
}

export async function createObjectiveService(input: {
  columnId?: string | null;
  title: string;
  description?: string;
  dueDate?: string | null;
  owner?: string | null;
  kind?: "objective" | "task";
  parentObjectiveId?: string | null;
  assignedUserId?: string | null;
}) {
  if (!input.title?.trim()) throw new Error("Informe um título para o objetivo.");
  // Sub-issue é uma "task" filha; só o item sem pai é "objective" por padrão.
  const kind = input.kind ?? (input.parentObjectiveId ? "task" : "objective");
  // A hierarquia é sobre aninhamento (tem pai ou não), não sobre "kind" — uma
  // tarefa pode ser avulsa (sem pai, aparece no board igual um objetivo) ou
  // aninhada dentro de um objetivo. "kind" é só rótulo/ícone, não estrutura.
  if (input.parentObjectiveId && input.columnId) {
    throw new Error("Um item vinculado a um objetivo pai não tem coluna própria.");
  }
  if (!input.parentObjectiveId && !input.columnId) {
    throw new Error("Informe a coluna do item.");
  }

  if (input.parentObjectiveId) {
    const parent = await objectivesRepository.findById(input.parentObjectiveId);
    if (!parent) throw new Error("Objetivo pai não encontrado.");
    // Só um nível de aninhamento: sub-issue não tem sub-issues.
    if (parent.parent_objective_id) throw new Error("Uma sub-issue não pode ter sub-issues.");
  }

  const all = await objectivesRepository.findAll();
  const siblingOrders = input.parentObjectiveId
    ? all.filter((o) => o.parent_objective_id === input.parentObjectiveId).map((o) => o.order)
    : null;
  // Pro filho, "último + 1" em vez de contagem: excluir uma sub-issue do meio não pode gerar ordem repetida.
  const order = siblingOrders
    ? Math.max(-1, ...siblingOrders) + 1
    : all.filter((o) => !o.parent_objective_id && o.column_id === input.columnId).length;

  const created = await objectivesRepository.create({ ...input, title: input.title.trim(), order, kind });
  await syncParentProgress(created.parent_objective_id);
  return created;
}

/**
 * O progresso de um objetivo com sub-issues é a média do progresso delas
 * (com sub-issues só em 0/100, vira "concluídas / total"). Fica no servidor pra
 * valer igual pra qualquer cliente — web, planejador por IA, etc.
 */
async function syncParentProgress(parentId: string | null | undefined) {
  if (!parentId) return;
  const children = await objectivesRepository.findChildren(parentId);
  if (children.length === 0) return;
  const progress = Math.round(children.reduce((sum, child) => sum + child.progress, 0) / children.length);
  await objectivesRepository.update(parentId, { progress });
}

export async function updateObjectiveService(id: string, patch: Record<string, unknown>) {
  const current = await objectivesRepository.findById(id);
  if (!current) throw new Error("Objetivo não encontrado.");

  let safePatch = patch;
  if ("progress" in patch && !current.parent_objective_id) {
    // Progresso manual é ignorado quando existem sub-issues — ele é derivado delas.
    const children = await objectivesRepository.findChildren(id);
    if (children.length > 0) {
      const { progress: _ignored, ...rest } = patch;
      safePatch = rest;
    }
  }

  const updated = await objectivesRepository.update(id, safePatch);

  // Pai antigo e novo (se mudou de pai) precisam recalcular.
  const parentIds = new Set([current.parent_objective_id, updated.parent_objective_id]);
  for (const parentId of parentIds) await syncParentProgress(parentId);
  return updated;
}

export async function deleteObjectiveService(id: string) {
  const current = await objectivesRepository.findById(id);
  // Sem depender de ON DELETE CASCADE no banco: sub-issues não ficam órfãs.
  await objectivesRepository.removeChildren(id);
  await objectivesRepository.remove(id);
  await syncParentProgress(current?.parent_objective_id);
}

export async function listSprintsService() {
  return objectivesRepository.findAllSprints();
}

export async function createSprintService(input: { name: string; startDate: string; endDate: string }) {
  if (!input.name?.trim()) throw new Error("Informe um nome para a sprint.");
  if (!input.startDate || !input.endDate) throw new Error("Informe o período da sprint.");
  return objectivesRepository.createSprint({ ...input, name: input.name.trim() });
}

export async function deleteSprintService(id: string) {
  await objectivesRepository.deleteSprint(id);
}
