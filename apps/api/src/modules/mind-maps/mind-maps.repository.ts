import { getSupabase } from "../../lib/supabase";

export interface MindMapBoardRow {
  id: string;
  name: string;
  canvas: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MindMapNodeRow {
  id: string;
  board_id: string;
  label: string;
  color: string;
  position_x: number;
  position_y: number;
  created_at: string;
}

export interface MindMapEdgeRow {
  id: string;
  board_id: string;
  source_node_id: string;
  target_node_id: string;
  label: string | null;
  created_at: string;
}

export interface MindMapGraphRows {
  board: MindMapBoardRow;
  nodes: MindMapNodeRow[];
  edges: MindMapEdgeRow[];
}

export interface MindMapNodeInput {
  id: string;
  label: string;
  color: string;
  position_x: number;
  position_y: number;
}

export interface MindMapEdgeInput {
  id: string;
  source_node_id: string;
  target_node_id: string;
  label?: string | null;
}

export async function findAllBoards(): Promise<MindMapBoardRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("mind_map_boards")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function findBoardById(id: string): Promise<MindMapBoardRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("mind_map_boards").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function findGraph(boardId: string): Promise<MindMapGraphRows | null> {
  const board = await findBoardById(boardId);
  if (!board) return null;

  const supabase = getSupabase();
  const [nodesResult, edgesResult] = await Promise.all([
    supabase.from("mind_map_nodes").select("*").eq("board_id", boardId),
    supabase.from("mind_map_edges").select("*").eq("board_id", boardId),
  ]);

  if (nodesResult.error) throw new Error(nodesResult.error.message);
  if (edgesResult.error) throw new Error(edgesResult.error.message);

  return { board, nodes: nodesResult.data ?? [], edges: edgesResult.data ?? [] };
}

export async function createBoard(name: string): Promise<MindMapBoardRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("mind_map_boards")
    .insert([{ name }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function renameBoard(id: string, name: string): Promise<MindMapBoardRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("mind_map_boards")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteBoard(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("mind_map_boards").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Substitui o grafo inteiro do quadro (salvar do canvas) — mesmo algoritmo
 * de apps/api/src/modules/flows/flows.repository.ts replaceFlow: ids dos nós
 * vêm do cliente e são preservados entre saves via upsert; nós removidos do
 * canvas são apagados; edges são baratas de recriar do zero a cada save.
 */
export async function replaceGraph(
  boardId: string,
  input: { nodes: MindMapNodeInput[]; edges: MindMapEdgeInput[]; canvas?: Record<string, unknown> },
): Promise<MindMapGraphRows> {
  const supabase = getSupabase();

  const board = await findBoardById(boardId);
  if (!board) throw new Error("Mapa mental não encontrado.");

  // Edges primeiro (referenciam nós que podem ser deletados a seguir)
  {
    const { error } = await supabase.from("mind_map_edges").delete().eq("board_id", boardId);
    if (error) throw new Error(error.message);
  }

  if (input.nodes.length > 0) {
    const rows = input.nodes.map((node) => ({
      id: node.id,
      board_id: boardId,
      label: node.label,
      color: node.color,
      position_x: node.position_x,
      position_y: node.position_y,
    }));
    const { error } = await supabase.from("mind_map_nodes").upsert(rows, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }

  const keptIds = input.nodes.map((node) => node.id);
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reassignar via filtro condicional explode a inferência de tipo do query builder
    let query: any = supabase.from("mind_map_nodes").delete().eq("board_id", boardId);
    if (keptIds.length > 0) query = query.not("id", "in", `(${keptIds.join(",")})`);
    const { error } = await query;
    if (error) throw new Error(error.message);
  }

  if (input.edges.length > 0) {
    const rows = input.edges.map((edge) => ({
      id: edge.id,
      board_id: boardId,
      source_node_id: edge.source_node_id,
      target_node_id: edge.target_node_id,
      label: edge.label ?? null,
    }));
    const { error } = await supabase.from("mind_map_edges").insert(rows);
    if (error) throw new Error(error.message);
  }

  {
    const { error } = await supabase
      .from("mind_map_boards")
      .update({ canvas: input.canvas ?? board.canvas, updated_at: new Date().toISOString() })
      .eq("id", boardId);
    if (error) throw new Error(error.message);
  }

  return (await findGraph(boardId))!;
}
