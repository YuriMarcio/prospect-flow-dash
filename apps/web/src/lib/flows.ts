import { request } from "@/lib/api";
import type { BotMessage } from "@/lib/prospector";

// ─── Tipos do fluxo (Visual Flow Builder) ────────────────────────────────────

export type FlowNodeType = "start" | "message" | "wait" | "intent_router" | "action";

export interface FlowVariant {
  message_id: string;
  limit: number | null;
}

export interface FlowNodeConfig {
  hours?: number | null;
  variants?: FlowVariant[];
  kind?: "move_kanban" | "end";
  column_id?: string;
  status?: string;
}

export interface ApiFlowNode {
  id: string;
  type: FlowNodeType;
  message_id?: string | null;
  config?: FlowNodeConfig;
  position_x: number;
  position_y: number;
}

export interface ApiFlowEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string;
}

export interface FlowGraph {
  flow: { id: string; canvas: Record<string, unknown> } | null;
  nodes: ApiFlowNode[];
  edges: ApiFlowEdge[];
}

export const INTENTS = [
  "interessado",
  "duvida_preco",
  "recusa",
  "pedindo_mais_info",
  "reclamacao",
  "fora_do_escopo",
] as const;

export type Intent = (typeof INTENTS)[number];

export const INTENT_LABELS: Record<Intent, string> = {
  interessado: "Interessado",
  duvida_preco: "Dúvida de preço",
  recusa: "Recusa",
  pedindo_mais_info: "Pedindo mais informações",
  reclamacao: "Reclamação",
  fora_do_escopo: "Fora do escopo",
};

export interface IntentResponse {
  id: string;
  prospecting_campaign_id: string;
  intent: string;
  message_id: string;
  personalize: boolean;
  enabled: boolean;
  bot_messages?: BotMessage | null;
}

export interface AiClassification {
  intencao: Intent;
  sentimento: "positivo" | "neutro" | "negativo";
  prontidao_para_reuniao: "alta" | "media" | "baixa";
  resposta_automatica: boolean;
  resumo: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export async function getFlow(campaignId: string): Promise<FlowGraph> {
  return request(`/prospecting-campaigns/${campaignId}/flow`);
}

export async function saveFlow(
  campaignId: string,
  input: { nodes: ApiFlowNode[]; edges: ApiFlowEdge[]; canvas?: Record<string, unknown> },
): Promise<FlowGraph> {
  return request(`/prospecting-campaigns/${campaignId}/flow`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function listIntentResponses(campaignId: string): Promise<IntentResponse[]> {
  return request(`/prospecting-campaigns/${campaignId}/intent-responses`);
}

export async function upsertIntentResponse(
  campaignId: string,
  intent: string,
  input: { message_id: string; personalize?: boolean; enabled?: boolean },
): Promise<IntentResponse> {
  return request(`/prospecting-campaigns/${campaignId}/intent-responses/${intent}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteIntentResponse(campaignId: string, intent: string): Promise<void> {
  await request(`/prospecting-campaigns/${campaignId}/intent-responses/${intent}`, {
    method: "DELETE",
  });
}

export async function testAiClassification(
  campaignId: string,
  text: string,
): Promise<AiClassification> {
  return request(`/prospecting-campaigns/${campaignId}/ai/test`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}
