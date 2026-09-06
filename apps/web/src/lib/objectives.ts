import { request } from "@/lib/api";

export interface ObjectiveColumn {
  id: string;
  title: string;
  color: string;
  order: number;
}

export interface Objective {
  id: string;
  columnId: string;
  title: string;
  description: string;
  status: string;
  progress: number;
  dueDate: string | null;
  owner: string | null;
  order: number;
  linkedPageId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ObjectiveColumnRow {
  id: string;
  title: string;
  color: string;
  order: number;
}

interface ObjectiveRow {
  id: string;
  column_id: string;
  title: string;
  description: string;
  status: string;
  progress: number;
  due_date: string | null;
  owner: string | null;
  order: number;
  linked_page_id: string | null;
  created_at: string;
  updated_at: string;
}

function fromColumnRow(row: ObjectiveColumnRow): ObjectiveColumn {
  return { id: row.id, title: row.title, color: row.color, order: row.order };
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

export async function updateObjectiveColumn(id: string, patch: { title?: string; color?: string }): Promise<ObjectiveColumn> {
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
  columnId: string;
  title: string;
  description?: string;
  dueDate?: string | null;
  owner?: string | null;
}): Promise<Objective> {
  const row = await request<ObjectiveRow>("/objectives", { method: "POST", body: JSON.stringify(input) });
  return fromRow(row);
}

export async function updateObjective(
  id: string,
  patch: Partial<{
    columnId: string;
    order: number;
    title: string;
    description: string;
    progress: number;
    dueDate: string | null;
    owner: string | null;
    status: string;
    linkedPageId: string | null;
  }>,
): Promise<Objective> {
  const row = await request<ObjectiveRow>(`/objectives/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  return fromRow(row);
}

export async function deleteObjective(id: string): Promise<void> {
  await request(`/objectives/${id}`, { method: "DELETE" });
}
