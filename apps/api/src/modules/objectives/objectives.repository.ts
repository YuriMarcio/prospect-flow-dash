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
  column_id: string;
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
  columnId: string;
  title: string;
  description?: string;
  dueDate?: string | null;
  owner?: string | null;
  order: number;
}): Promise<ObjectiveRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("objectives")
    .insert([
      {
        column_id: input.columnId,
        title: input.title,
        description: input.description ?? "",
        due_date: input.dueDate ?? null,
        owner: input.owner ?? null,
        order: input.order,
      },
    ])
    .select()
    .single();
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

export async function deleteSprint(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("sprints").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
