import { randomUUID } from "node:crypto";
import * as templatesRepository from "./flow-templates.repository";
import * as flowsRepository from "../flows/flows.repository";
import type { FlowEdgeInput, FlowNodeInput } from "../flows/flows.repository";
import * as messagesRepository from "../prospector/messages.repository";

export async function listTemplatesService() {
  return templatesRepository.findAll();
}

export async function createTemplateFromCampaignService(input: {
  campaignId: string;
  name: string;
  description?: string;
}) {
  if (!input.name?.trim()) throw new Error("Informe um nome para o modelo.");

  const graph = await flowsRepository.findByCampaignId(input.campaignId);
  if (!graph || graph.nodes.length === 0) {
    throw new Error("Essa campanha ainda não tem um fluxo salvo pra virar modelo.");
  }

  const sourceNodes = await Promise.all(
    graph.nodes.map(async (node) => {
      const message = node.message_id ? await messagesRepository.findById(node.message_id) : null;
      return {
        id: node.id,
        type: node.type,
        config: node.config,
        position_x: node.position_x,
        position_y: node.position_y,
        message: message
          ? { title: message.title, status: message.status, bot_message_blocks: message.bot_message_blocks }
          : null,
      };
    }),
  );

  return templatesRepository.create(
    { name: input.name.trim(), description: input.description?.trim() || undefined },
    sourceNodes,
    graph.edges,
  );
}

export async function deleteTemplateService(id: string) {
  return templatesRepository.remove(id);
}

/**
 * Aplica um modelo numa campanha: recria as mensagens (novas linhas de
 * bot_messages presas a essa campanha) e substitui o fluxo inteiro da
 * campanha pelo grafo do modelo — mesmo comportamento de "Salvar" do editor.
 */
export async function applyTemplateService(campaignId: string, templateId: string) {
  const template = await templatesRepository.findById(templateId);
  if (!template) throw new Error("Modelo não encontrado.");

  const idMap = new Map<string, string>();
  const nodes: FlowNodeInput[] = [];

  for (const node of template.nodes) {
    const newId = randomUUID();
    idMap.set(node.id, newId);

    // Nó de mensagem sempre precisa de message_id (replaceFlow não valida o
    // grafo como o "Salvar" do editor faz) — cria mesmo se sem blocos ainda.
    let messageId: string | null = null;
    if (node.type === "message") {
      const created = await messagesRepository.create(campaignId, {
        title: node.message_title ?? "Mensagem",
        status: "draft",
        blocks: node.message_blocks,
      });
      messageId = created.id;
    }

    nodes.push({
      id: newId,
      type: node.type,
      message_id: messageId,
      config: node.config,
      position_x: node.position_x,
      position_y: node.position_y,
    });
  }

  const edges: FlowEdgeInput[] = template.edges
    .map((edge) => ({
      id: randomUUID(),
      source_node_id: idMap.get(edge.source_node_id)!,
      target_node_id: idMap.get(edge.target_node_id)!,
      source_handle: edge.source_handle,
    }))
    .filter((edge) => edge.source_node_id && edge.target_node_id);

  return flowsRepository.replaceFlow(campaignId, { nodes, edges, canvas: {} });
}
