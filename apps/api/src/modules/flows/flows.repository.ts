import { getSupabase } from "../../lib/supabase";

export interface MessageFlowRow {
  id: string;
  prospecting_campaign_id: string;
  canvas: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type FlowNodeType = "start" | "message" | "wait" | "intent_router" | "action";

export interface FlowNodeRow {
  id: string;
  flow_id: string;
  type: FlowNodeType;
  message_id: string | null;
  config: Record<string, unknown>;
  position_x: number;
  position_y: number;
  created_at: string;
}

export interface FlowEdgeRow {
  id: string;
  flow_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string;
  created_at: string;
}

export interface FlowGraphRows {
  flow: MessageFlowRow;
  nodes: FlowNodeRow[];
  edges: FlowEdgeRow[];
}

export interface FlowNodeInput {
  id: string;
  type: FlowNodeType;
  message_id?: string | null;
  config?: Record<string, unknown>;
  position_x: number;
  position_y: number;
}

export interface FlowEdgeInput {
  id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string;
}

export async function findByCampaignId(campaignId: string): Promise<FlowGraphRows | null> {
  const supabase = getSupabase();
  const { data: flow, error } = await supabase
    .from("message_flows")
    .select("*")
    .eq("prospecting_campaign_id", campaignId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!flow) return null;

  const [nodesResult, edgesResult] = await Promise.all([
    supabase.from("flow_nodes").select("*").eq("flow_id", flow.id),
    supabase.from("flow_edges").select("*").eq("flow_id", flow.id),
  ]);

  if (nodesResult.error) throw new Error(nodesResult.error.message);
  if (edgesResult.error) throw new Error(edgesResult.error.message);

  return { flow, nodes: nodesResult.data ?? [], edges: edgesResult.data ?? [] };
}

/**
 * Substitui o grafo inteiro da campanha (salvar do canvas). Os ids dos nós
 * vêm do cliente e são preservados entre saves — assim leads parados num nó
 * que não foi removido continuam no lugar. Estados apontando para nós
 * deletados (FK vira null) são marcados como "stopped".
 */
export async function replaceFlow(
  campaignId: string,
  input: { nodes: FlowNodeInput[]; edges: FlowEdgeInput[]; canvas?: Record<string, unknown> },
): Promise<FlowGraphRows> {
  const supabase = getSupabase();

  let existing = await findByCampaignId(campaignId);
  if (!existing) {
    const { data: created, error } = await supabase
      .from("message_flows")
      .insert([{ prospecting_campaign_id: campaignId, canvas: input.canvas ?? {} }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    existing = { flow: created, nodes: [], edges: [] };
  }

  const flowId = existing.flow.id;

  // Edges primeiro (referenciam nós que podem ser deletados a seguir)
  {
    const { error } = await supabase.from("flow_edges").delete().eq("flow_id", flowId);
    if (error) throw new Error(error.message);
  }

  if (input.nodes.length > 0) {
    const rows = input.nodes.map((node) => ({
      id: node.id,
      flow_id: flowId,
      type: node.type,
      message_id: node.message_id ?? null,
      config: node.config ?? {},
      position_x: node.position_x,
      position_y: node.position_y,
    }));
    const { error } = await supabase.from("flow_nodes").upsert(rows, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }

  // Remove nós que saíram do canvas
  const keptIds = input.nodes.map((node) => node.id);
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reassignar via filtro condicional explode a inferência de tipo do query builder
    let query: any = supabase.from("flow_nodes").delete().eq("flow_id", flowId);
    if (keptIds.length > 0) query = query.not("id", "in", `(${keptIds.join(",")})`);
    const { error } = await query;
    if (error) throw new Error(error.message);
  }

  if (input.edges.length > 0) {
    const rows = input.edges.map((edge) => ({
      id: edge.id,
      flow_id: flowId,
      source_node_id: edge.source_node_id,
      target_node_id: edge.target_node_id,
      source_handle: edge.source_handle,
    }));
    const { error } = await supabase.from("flow_edges").insert(rows);
    if (error) throw new Error(error.message);
  }

  // Leads cujo nó atual foi deletado (FK set null) param de andar no fluxo
  {
    const { error } = await supabase
      .from("lead_flow_states")
      .update({ status: "stopped", updated_at: new Date().toISOString() })
      .eq("flow_id", flowId)
      .is("current_node_id", null)
      .in("status", ["active", "waiting_dispatch", "waiting_timer", "processing"]);
    if (error) throw new Error(error.message);
  }

  {
    const { error } = await supabase
      .from("message_flows")
      .update({ canvas: input.canvas ?? existing.flow.canvas, updated_at: new Date().toISOString() })
      .eq("id", flowId);
    if (error) throw new Error(error.message);
  }

  return (await findByCampaignId(campaignId))!;
}
