import * as objectivesRepository from "./objectives.repository";
import type { ObjectiveRow } from "./objectives.repository";
import {
  MAX_DEPTH,
  OBJECTIVE_AREAS,
  OBJECTIVE_PRIORITIES,
  buildObjectiveTreeRows,
  type ObjectiveTreeNode,
} from "./objective-tree";

export { OBJECTIVE_AREAS, OBJECTIVE_PRIORITIES };

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

function assertOneOf(value: unknown, allowed: readonly string[], label: string) {
  if (value === undefined || value === null) return;
  if (typeof value !== "string" || !allowed.includes(value)) throw new Error(`${label} inválida.`);
}

/** Quantos níveis o item está abaixo do objetivo de topo (0 = topo). */
function depthOf(row: ObjectiveRow, byId: Map<string, ObjectiveRow>): number {
  let depth = 0;
  let current: ObjectiveRow | undefined = row;
  while (current?.parent_objective_id && depth <= MAX_DEPTH + 1) {
    current = byId.get(current.parent_objective_id);
    depth += 1;
  }
  return depth;
}

/** O item e todos os descendentes dele. */
function collectSubtreeIds(all: ObjectiveRow[], rootId: string): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const row of all) {
    if (!row.parent_objective_id) continue;
    const siblings = childrenByParent.get(row.parent_objective_id) ?? [];
    siblings.push(row.id);
    childrenByParent.set(row.parent_objective_id, siblings);
  }
  const ids = [rootId];
  for (let i = 0; i < ids.length; i += 1) ids.push(...(childrenByParent.get(ids[i]) ?? []));
  return ids;
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
  sprintId?: string | null;
  area?: string | null;
  priority?: string | null;
}) {
  if (!input.title?.trim()) throw new Error("Informe um título para o objetivo.");
  assertOneOf(input.area, OBJECTIVE_AREAS, "Área");
  assertOneOf(input.priority, OBJECTIVE_PRIORITIES, "Prioridade");
  // Item com pai (marco, issue, subissue) é uma "task"; só o item sem pai é "objective" por padrão.
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

  const all = await objectivesRepository.findAll();
  const byId = new Map(all.map((o) => [o.id, o]));

  if (input.parentObjectiveId) {
    const parent = byId.get(input.parentObjectiveId);
    if (!parent) throw new Error("Objetivo pai não encontrado.");
    if (depthOf(parent, byId) + 1 > MAX_DEPTH) {
      throw new Error("Limite de níveis atingido (objetivo → marco → issue → subissue).");
    }
  }

  let order: number;
  let codeNumber: number | null = null;
  if (input.parentObjectiveId) {
    // "último + 1" em vez de contagem: excluir um item do meio não pode gerar ordem repetida.
    const siblingOrders = all.filter((o) => o.parent_objective_id === input.parentObjectiveId).map((o) => o.order);
    order = Math.max(-1, ...siblingOrders) + 1;
  } else {
    order = all.filter((o) => !o.parent_objective_id && o.column_id === input.columnId).length;
    codeNumber = Math.max(0, ...all.filter((o) => !o.parent_objective_id).map((o) => o.code_number ?? 0)) + 1;
  }

  const created = await objectivesRepository.create({
    ...input,
    title: input.title.trim(),
    order,
    kind,
    codeNumber,
  });
  await syncAncestorsProgress(created.parent_objective_id);
  return created;
}

/**
 * Cria várias árvores (objetivo → marcos → issues → subissues) de uma vez, na coluna dada.
 * Uma leitura e uma gravação só — criar item por item refaria a consulta do quadro inteiro a cada um.
 * Devolve os ids criados (topo e filhos).
 */
export async function createObjectiveTreesService(roots: ObjectiveTreeNode[], columnId: string): Promise<string[]> {
  if (!columnId) throw new Error("Informe a coluna do item.");
  const existing = await objectivesRepository.findAll();
  const rows = buildObjectiveTreeRows(roots, { columnId, existing });
  const created = await objectivesRepository.createMany(rows);
  return created.map((row) => row.id);
}

/**
 * O progresso de quem tem filhos é a média do progresso deles, subindo a
 * árvore inteira: subissues → issue → marco → objetivo (nas folhas, só 0/100).
 * Fica no servidor pra valer igual pra qualquer cliente — web, planejador por IA, etc.
 */
async function syncAncestorsProgress(parentId: string | null | undefined) {
  const visited = new Set<string>();
  let currentId = parentId;
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const children = await objectivesRepository.findChildren(currentId);
    // Sem filhos (o último foi excluído): o item volta a ser folha e mantém o progresso que tinha.
    if (children.length === 0) return;
    const progress = Math.round(children.reduce((sum, child) => sum + child.progress, 0) / children.length);
    const current = await objectivesRepository.findById(currentId);
    if (!current) return;
    if (current.progress !== progress) await objectivesRepository.update(currentId, { progress });
    currentId = current.parent_objective_id;
  }
}

export async function updateObjectiveService(id: string, patch: Record<string, unknown>) {
  if ("area" in patch) assertOneOf(patch.area, OBJECTIVE_AREAS, "Área");
  if ("priority" in patch) assertOneOf(patch.priority, OBJECTIVE_PRIORITIES, "Prioridade");
  if ("title" in patch && !String(patch.title ?? "").trim()) throw new Error("Informe um título.");

  const current = await objectivesRepository.findById(id);
  if (!current) throw new Error("Objetivo não encontrado.");

  let safePatch = patch;
  if ("progress" in patch) {
    // Progresso manual é ignorado quando existem filhos — ele é derivado deles.
    const children = await objectivesRepository.findChildren(id);
    if (children.length > 0) {
      const { progress: _ignored, ...rest } = patch;
      safePatch = rest;
    }
  }

  const updated = await objectivesRepository.update(id, safePatch);

  // Pai antigo e novo (se mudou de pai) precisam recalcular.
  const parentIds = new Set([current.parent_objective_id, updated.parent_objective_id]);
  for (const parentId of parentIds) await syncAncestorsProgress(parentId);
  return updated;
}

export async function deleteObjectiveService(id: string) {
  const all = await objectivesRepository.findAll();
  const current = all.find((o) => o.id === id);
  // Sem depender de ON DELETE CASCADE no banco: marcos, issues e subissues não ficam órfãos.
  await objectivesRepository.removeMany(collectSubtreeIds(all, id));
  await syncAncestorsProgress(current?.parent_objective_id);
}

export async function listSprintsService() {
  return objectivesRepository.findAllSprints();
}

function parseSprintInput(input: { name: string; startDate: string; endDate: string }) {
  if (!input.name?.trim()) throw new Error("Informe um nome para a sprint.");
  if (!input.startDate || !input.endDate) throw new Error("Informe o período da sprint.");
  // Datas "YYYY-MM-DD" — comparação textual equivale à cronológica.
  if (input.endDate < input.startDate) throw new Error("O fim da sprint não pode ser antes do início.");
  return { ...input, name: input.name.trim() };
}

export async function createSprintService(input: { name: string; startDate: string; endDate: string }) {
  return objectivesRepository.createSprint(parseSprintInput(input));
}

export async function updateSprintService(id: string, input: { name: string; startDate: string; endDate: string }) {
  return objectivesRepository.updateSprint(id, parseSprintInput(input));
}

export async function deleteSprintService(id: string) {
  await objectivesRepository.deleteSprint(id);
}
