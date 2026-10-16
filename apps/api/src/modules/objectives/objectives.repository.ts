import { getSupabase } from "../../lib/supabase";

export interface ObjectiveColumnRow {
  id: string;
  title: string;
  color: string;
  order: number;
  is_done: boolean;
  created_at: string;
}

export interface ObjectiveRow {
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
  area: string | null;
  priority: string | null;
  /** Número sequencial só dos itens de topo — vira o código "OBJ-003" na tela. */
  code_number: number | null;
  created_at: string;
  updated_at: string;
}

export interface SprintRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export async function listColumns(): Promise<ObjectiveColumnRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("objective_columns")
    .select("*")
    .order("order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createColumn(title: string): Promise<ObjectiveColumnRow> {
  const supabase = getSupabase();
  const columns = await listColumns();
  const { data, error } = await supabase
    .from("objective_columns")
    .insert([{ title, order: columns.length }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateColumn(
  id: string,
  patch: { title?: string; color?: string; is_done?: boolean },
): Promise<ObjectiveColumnRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("objective_columns")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function reorderColumns(orderedIds: string[]): Promise<void> {
  const supabase = getSupabase();
  await Promise.all(
    orderedIds.map((id, index) => supabase.from("objective_columns").update({ order: index }).eq("id", id)),
  );
}

export async function deleteColumn(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("objective_columns").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reassignObjectives(fromColumnId: string, toColumnId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("objectives")
    .update({ column_id: toColumnId })
    .eq("column_id", fromColumnId);
  if (error) throw new Error(error.message);
}

export async function findAll(): Promise<ObjectiveRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("objectives")
    .select("*")
    .order("order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function create(input: {
  columnId?: string | null;
  title: string;
  description?: string;
  dueDate?: string | null;
  owner?: string | null;
  order: number;
  kind?: "objective" | "task";
  parentObjectiveId?: string | null;
  assignedUserId?: string | null;
  sprintId?: string | null;
  area?: string | null;
  priority?: string | null;
  codeNumber?: number | null;
}): Promise<ObjectiveRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("objectives")
    .insert([
      {
        column_id: input.columnId ?? null,
        title: input.title,
        description: input.description ?? "",
        due_date: input.dueDate ?? null,
        owner: input.owner ?? null,
        order: input.order,
        kind: input.kind ?? "objective",
        parent_objective_id: input.parentObjectiveId ?? null,
        assigned_user_id: input.assignedUserId ?? null,
        sprint_id: input.sprintId ?? null,
        area: input.area ?? null,
        priority: input.priority ?? null,
        code_number: input.codeNumber ?? null,
      },
    ])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Insere vários itens de uma vez (em lotes, pra não estourar o limite de uma requisição). */
export async function createMany(rows: Array<Record<string, unknown> & { id: string }>): Promise<ObjectiveRow[]> {
  const supabase = getSupabase();
  const created: ObjectiveRow[] = [];
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { data, error } = await supabase.from("objectives").insert(rows.slice(i, i + BATCH)).select();
    if (error) {
      // Lote que falhou no meio: desfaz o que já entrou pra não deixar árvore pela metade.
      if (created.length > 0) await supabase.from("objectives").delete().in("id", created.map((r) => r.id));
      throw new Error(error.message);
    }
    created.push(...(data ?? []));
  }
  return created;
}

/** Itens de topo (aparecem no board) — objetivos e tarefas avulsas, exclui só as tarefas aninhadas. */
export async function findAllTopLevel(): Promise<ObjectiveRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("objectives")
    .select("*")
    .is("parent_objective_id", null)
    .order("order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Tarefas de um objetivo específico, na ordem em que foram criadas. */
export async function findChildren(parentObjectiveId: string): Promise<ObjectiveRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("objectives")
    .select("*")
    .eq("parent_objective_id", parentObjectiveId)
    .order("order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function findById(id: string): Promise<ObjectiveRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("objectives").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function update(id: string, patch: Record<string, unknown>): Promise<ObjectiveRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("objectives")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function remove(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("objectives").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeMany(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = getSupabase();
  const { error } = await supabase.from("objectives").delete().in("id", ids);
  if (error) throw new Error(error.message);
}

export async function findAllSprints(): Promise<SprintRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("sprints")
    .select("*")
    .order("start_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createSprint(input: { name: string; startDate: string; endDate: string }): Promise<SprintRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("sprints")
    .insert([{ name: input.name, start_date: input.startDate, end_date: input.endDate }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSprint(
  id: string,
  input: { name: string; startDate: string; endDate: string },
): Promise<SprintRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("sprints")
    .update({ name: input.name, start_date: input.startDate, end_date: input.endDate })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSprint(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("sprints").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
