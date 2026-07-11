import { randomUUID } from "node:crypto";
import { getSupabase } from "../../lib/supabase";
import type { FlowNodeType } from "../flows/flows.repository";

export interface FlowTemplateRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface TemplateMessageBlock {
  type: "text" | "image" | "audio";
  content: string;
  caption: string | null;
  position: number;
}

export interface FlowTemplateNodeRow {
  id: string;
  template_id: string;
  type: FlowNodeType;
  config: Record<string, unknown>;
  position_x: number;
  position_y: number;
  message_title: string | null;
  message_status: string | null;
  message_blocks: TemplateMessageBlock[];
  created_at: string;
}

export interface FlowTemplateEdgeRow {
  id: string;
  template_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string;
}

export interface FlowTemplateGraph {
  template: FlowTemplateRow;
  nodes: FlowTemplateNodeRow[];
  edges: FlowTemplateEdgeRow[];
}

/** Nó de origem (de uma campanha real) a partir do qual o template é montado. */
export interface TemplateSourceNode {
  id: string;
  type: FlowNodeType;
  config: Record<string, unknown>;
  position_x: number;
  position_y: number;
  message: {
    title: string;
    status: string;
    bot_message_blocks: TemplateMessageBlock[];
  } | null;
}

export interface TemplateSourceEdge {
  source_node_id: string;
  target_node_id: string;
  source_handle: string;
}

export async function findAll(): Promise<Array<FlowTemplateRow & { node_count: number }>> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("flow_templates")
    .select("*, flow_template_nodes(count)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: FlowTemplateRow & { flow_template_nodes: { count: number }[] }) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    created_at: row.created_at,
    node_count: row.flow_template_nodes?.[0]?.count ?? 0,
  }));
}

export async function findById(id: string): Promise<FlowTemplateGraph | null> {
  const supabase = getSupabase();
  const { data: template, error } = await supabase
    .from("flow_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!template) return null;

  const [nodesResult, edgesResult] = await Promise.all([
    supabase.from("flow_template_nodes").select("*").eq("template_id", id),
    supabase.from("flow_template_edges").select("*").eq("template_id", id),
  ]);
  if (nodesResult.error) throw new Error(nodesResult.error.message);
  if (edgesResult.error) throw new Error(edgesResult.error.message);

  return { template, nodes: nodesResult.data ?? [], edges: edgesResult.data ?? [] };
}

/** Cria um template congelando o estado atual de um fluxo (nós + mensagens + arestas). */
export async function create(
  input: { name: string; description?: string },
  sourceNodes: TemplateSourceNode[],
  sourceEdges: TemplateSourceEdge[],
): Promise<FlowTemplateGraph> {
  const supabase = getSupabase();

  const { data: template, error } = await supabase
    .from("flow_templates")
    .insert([{ name: input.name, description: input.description ?? null }])
    .select()
    .single();
  if (error) throw new Error(error.message);

  const idMap = new Map<string, string>();
  const nodeRows = sourceNodes.map((node) => {
    const newId = randomUUID();
    idMap.set(node.id, newId);
    return {
      id: newId,
      template_id: template.id,
      type: node.type,
      config: node.config ?? {},
      position_x: node.position_x,
      position_y: node.position_y,
      message_title: node.message?.title ?? null,
      message_status: node.message?.status ?? null,
      message_blocks: node.message?.bot_message_blocks ?? [],
    };
  });

  if (nodeRows.length > 0) {
    const { error: nodesError } = await supabase.from("flow_template_nodes").insert(nodeRows);
    if (nodesError) throw new Error(nodesError.message);
  }

  const edgeRows = sourceEdges
    .map((edge) => ({
      id: randomUUID(),
      template_id: template.id,
      source_node_id: idMap.get(edge.source_node_id),
      target_node_id: idMap.get(edge.target_node_id),
      source_handle: edge.source_handle,
    }))
    .filter(
      (edge): edge is { id: string; template_id: string; source_node_id: string; target_node_id: string; source_handle: string } =>
        Boolean(edge.source_node_id && edge.target_node_id),
    );

  if (edgeRows.length > 0) {
    const { error: edgesError } = await supabase.from("flow_template_edges").insert(edgeRows);
    if (edgesError) throw new Error(edgesError.message);
  }

  return (await findById(template.id))!;
}

export async function remove(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("flow_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
