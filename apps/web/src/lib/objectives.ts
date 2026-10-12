import { request } from "@/lib/api";

export interface ObjectiveColumn {
  id: string;
  title: string;
  color: string;
  order: number;
  isDone: boolean;
}

export type ObjectiveArea = "vendas" | "marketing" | "administrativo" | "desenvolvimento";
export type ObjectivePriority = "critica" | "alta" | "media" | "baixa";

export interface Objective {
  id: string;
  columnId: string | null;
  title: string;
  description: string;
  status: string;
  progress: number;
  dueDate: string | null;
  owner: string | null;
  order: number;
  linkedPageId: string | null;
  sprintId: string | null;
  assignedUserId: string | null;
  /** "task" = item filho (marco, issue ou subissue) ou tarefa avulsa; com `parentObjectiveId` não aparece no board. */
  kind: "objective" | "task";
  /** Hierarquia: objetivo → marco → issue → subissue, todos ligados por este campo. */
  parentObjectiveId: string | null;
  area: ObjectiveArea | null;
  priority: ObjectivePriority | null;
  /** Número sequencial dos itens de topo ("OBJ-003"). */
  codeNumber: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface TeamUser {
  id: string;
  name: string | null;
  username: string | null;
}

interface ObjectiveColumnRow {
  id: string;
  title: string;
  color: string;
  order: number;
  is_done: boolean;
}

interface ObjectiveRow {
  id: string;
  column_id: string | null;
  title: string;
  description: string;
  status: string;
  progress: number;
  due_date: string | null;
  owner: string | null;
  order: number;
  linked_page_id: string | null;
  sprint_id: string | null;
  assigned_user_id: string | null;
  kind: "objective" | "task";
  parent_objective_id: string | null;
  area: ObjectiveArea | null;
  priority: ObjectivePriority | null;
  code_number: number | null;
  created_at: string;
  updated_at: string;
}

interface SprintRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

function fromColumnRow(row: ObjectiveColumnRow): ObjectiveColumn {
  return { id: row.id, title: row.title, color: row.color, order: row.order, isDone: row.is_done };
}

function fromRow(row: ObjectiveRow): Objective {
  return {
    id: row.id,
    columnId: row.column_id,
    title: row.title,
    description: row.description,
    status: row.status,
    progress: row.progress,
    dueDate: row.due_date,
    owner: row.owner,
    order: row.order,
    linkedPageId: row.linked_page_id,
    sprintId: row.sprint_id,
    assignedUserId: row.assigned_user_id,
    kind: row.kind,
    parentObjectiveId: row.parent_objective_id,
    area: row.area,
    priority: row.priority,
    codeNumber: row.code_number,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromSprintRow(row: SprintRow): Sprint {
  return { id: row.id, name: row.name, startDate: row.start_date, endDate: row.end_date };
}

export async function listObjectiveColumns(): Promise<ObjectiveColumn[]> {
  const rows = await request<ObjectiveColumnRow[]>("/objectives/columns");
  return rows.map(fromColumnRow);
}

export async function createObjectiveColumn(title: string): Promise<ObjectiveColumn> {
  const row = await request<ObjectiveColumnRow>("/objectives/columns", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  return fromColumnRow(row);
}

export async function updateObjectiveColumn(
  id: string,
  patch: { title?: string; color?: string; isDone?: boolean },
): Promise<ObjectiveColumn> {
  const row = await request<ObjectiveColumnRow>(`/objectives/columns/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return fromColumnRow(row);
}

export async function deleteObjectiveColumn(id: string): Promise<void> {
  await request(`/objectives/columns/${id}`, { method: "DELETE" });
}

export async function listObjectives(): Promise<Objective[]> {
  const rows = await request<ObjectiveRow[]>("/objectives");
  return rows.map(fromRow);
}

export async function createObjective(input: {
  /** Obrigatório pra itens de topo; filhos (com `parentObjectiveId`) não têm coluna. */
  columnId?: string;
  title: string;
  description?: string;
  dueDate?: string | null;
  owner?: string | null;
  kind?: "objective" | "task";
  parentObjectiveId?: string;
  assignedUserId?: string | null;
  sprintId?: string | null;
  area?: ObjectiveArea | null;
  priority?: ObjectivePriority | null;
}): Promise<Objective> {
  const row = await request<ObjectiveRow>("/objectives", { method: "POST", body: JSON.stringify(input) });
  return fromRow(row);
}

export async function updateObjective(
  id: string,
  patch: Partial<{
    columnId: string | null;
    order: number;
    title: string;
    description: string;
    progress: number;
    dueDate: string | null;
    owner: string | null;
    status: string;
    linkedPageId: string | null;
    sprintId: string | null;
    assignedUserId: string | null;
    area: ObjectiveArea | null;
    priority: ObjectivePriority | null;
  }>,
): Promise<Objective> {
  const row = await request<ObjectiveRow>(`/objectives/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  return fromRow(row);
}

export async function deleteObjective(id: string): Promise<void> {
  await request(`/objectives/${id}`, { method: "DELETE" });
}

export async function listSprints(): Promise<Sprint[]> {
  const rows = await request<SprintRow[]>("/objectives/sprints");
  return rows.map(fromSprintRow);
}

export async function createSprint(input: { name: string; startDate: string; endDate: string }): Promise<Sprint> {
  const row = await request<SprintRow>("/objectives/sprints", { method: "POST", body: JSON.stringify(input) });
  return fromSprintRow(row);
}

export async function updateSprint(
  id: string,
  input: { name: string; startDate: string; endDate: string },
): Promise<Sprint> {
  const row = await request<SprintRow>(`/objectives/sprints/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  return fromSprintRow(row);
}

export async function deleteSprint(id: string): Promise<void> {
  await request(`/objectives/sprints/${id}`, { method: "DELETE" });
}

export async function listTeamUsers(): Promise<TeamUser[]> {
  return request("/auth/users");
}
