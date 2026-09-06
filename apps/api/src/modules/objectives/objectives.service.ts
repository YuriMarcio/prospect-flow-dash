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
  columnId: string;
  title: string;
  description?: string;
  dueDate?: string | null;
  owner?: string | null;
}) {
  if (!input.title?.trim()) throw new Error("Informe um título para o objetivo.");
  const all = await objectivesRepository.findAll();
  const order = all.filter((o) => o.column_id === input.columnId).length;
  return objectivesRepository.create({ ...input, title: input.title.trim(), order });
}

export async function updateObjectiveService(id: string, patch: Record<string, unknown>) {
  return objectivesRepository.update(id, patch);
}

export async function deleteObjectiveService(id: string) {
  await objectivesRepository.remove(id);
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
