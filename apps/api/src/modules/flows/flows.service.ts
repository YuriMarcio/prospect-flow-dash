import * as flowsRepository from "./flows.repository";
import type { FlowEdgeInput, FlowNodeInput } from "./flows.repository";

const NODE_TYPES = new Set(["start", "message", "wait", "intent_router", "action"]);

/**
 * Valida o grafo antes de salvar. Regras mínimas para o motor não se perder:
 * 1 nó de início, nós de mensagem com mensagem associada, waits com horas
 * válidas, roteadores de intenção com saída "fallback" e no máximo uma aresta
 * por par (nó, saída).
 */
function validateGraph(nodes: FlowNodeInput[], edges: FlowEdgeInput[]): void {
  const errors: string[] = [];
  const nodeIds = new Set(nodes.map((node) => node.id));

  if (nodeIds.size !== nodes.length) errors.push("Existem nós com ids duplicados.");

  const starts = nodes.filter((node) => node.type === "start");
  if (starts.length !== 1) errors.push("O fluxo precisa de exatamente 1 nó de início.");

  for (const node of nodes) {
    if (!NODE_TYPES.has(node.type)) {
      errors.push(`Tipo de nó desconhecido: "${node.type}".`);
      continue;
    }
    if (node.type === "message" && !node.message_id) {
      errors.push("Há um nó de mensagem sem mensagem configurada.");
    }
    if (node.type === "wait") {
      const hours = (node.config as { hours?: unknown } | undefined)?.hours ?? null;
      if (hours !== null && (typeof hours !== "number" || hours < 0)) {
        errors.push("Nó de espera com horas inválidas (use um número >= 0 ou vazio para aguardar indefinidamente).");
      }
    }
  }

  const handlesSeen = new Set<string>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.source_node_id) || !nodeIds.has(edge.target_node_id)) {
      errors.push("Há uma conexão apontando para um nó que não existe.");
      continue;
    }
    if (!edge.source_handle) {
      errors.push("Há uma conexão sem saída definida.");
      continue;
    }
    const key = `${edge.source_node_id}:${edge.source_handle}`;
    if (handlesSeen.has(key)) errors.push("Há duas conexões saindo da mesma porta de um nó.");
    handlesSeen.add(key);
  }

  for (const node of nodes) {
    if (node.type !== "intent_router") continue;
    const hasFallback = edges.some(
      (edge) => edge.source_node_id === node.id && edge.source_handle === "fallback",
    );
    if (!hasFallback) {
      errors.push('Todo nó "Classificar resposta" precisa de uma conexão na saída "fallback".');
    }
  }

  if (errors.length > 0) throw new Error(errors.join(" "));
}

export async function getFlowService(campaignId: string) {
  const graph = await flowsRepository.findByCampaignId(campaignId);
  return graph ?? { flow: null, nodes: [], edges: [] };
}

export async function saveFlowService(
  campaignId: string,
  input: { nodes: FlowNodeInput[]; edges: FlowEdgeInput[]; canvas?: Record<string, unknown> },
) {
  const nodes = input.nodes ?? [];
  const edges = input.edges ?? [];
  validateGraph(nodes, edges);
  return flowsRepository.replaceFlow(campaignId, { nodes, edges, canvas: input.canvas });
}
