import * as flowsRepository from "../../modules/flows/flows.repository";
import type { FlowEdgeRow, FlowNodeRow, MessageFlowRow } from "../../modules/flows/flows.repository";
import * as leadFlowStateRepository from "../../modules/prospector/lead-flow-state.repository";
import * as messagesRepository from "../../modules/prospector/messages.repository";
import type { BotMessageRow } from "../../modules/prospector/messages.repository";
import * as queueRepository from "../../modules/prospector/queue.repository";
import * as leadsRepository from "../../modules/leads/leads.repository";
import * as campaignsRepository from "../../modules/prospecting-campaigns/prospecting-campaigns.repository";
import type { ProspectingCampaignRow } from "../../modules/prospecting-campaigns/prospecting-campaigns.repository";
import * as botLogs from "../../modules/prospector/botlogs.repository";
import { getEvolutionClient } from "../../lib/evolution";
import { sendMessageBlocks } from "./send-blocks";

const WEEKDAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;

/** Trava de segurança contra ciclos no grafo desenhado pelo usuário. */
const MAX_CHAIN_HOPS = 20;

export interface LoadedGraph {
  flow: MessageFlowRow;
  nodes: Map<string, FlowNodeRow>;
  edges: FlowEdgeRow[];
}

interface VariantConfig {
  message_id: string;
  limit: number | null;
}

interface ChainContext {
  graph: LoadedGraph;
  campaign: ProspectingCampaignRow;
  leadId: string;
  /**
   * "enqueue": próximo nó de mensagem entra na dispatch_queue (follow-up).
   * "immediate": envia agora pela instância informada (lead acabou de responder).
   */
  mode: "enqueue" | "immediate";
  instanceName?: string;
  phone?: string;
  intent?: string | null;
  lastDispatchId?: string | null;
}

export async function loadGraph(campaignId: string): Promise<LoadedGraph | null> {
  const graph = await flowsRepository.findByCampaignId(campaignId);
  if (!graph) return null;
  return {
    flow: graph.flow,
    nodes: new Map(graph.nodes.map((node) => [node.id, node])),
    edges: graph.edges,
  };
}

function findTarget(graph: LoadedGraph, nodeId: string, handle: string): FlowNodeRow | null {
  const edge = graph.edges.find(
    (candidate) => candidate.source_node_id === nodeId && candidate.source_handle === handle,
  );
  return edge ? graph.nodes.get(edge.target_node_id) ?? null : null;
}

function nodeVariants(node: FlowNodeRow): VariantConfig[] {
  const variants = (node.config as { variants?: VariantConfig[] } | undefined)?.variants;
  return Array.isArray(variants) ? variants : [];
}

/**
 * Escolhe a mensagem de um nó: primeiro variante A/B com uso abaixo do limite,
 * senão a mensagem padrão do nó. O overlay soma usos ainda não persistidos
 * (fila sendo construída agora) para a rotação distribuir dentro do mesmo build.
 */
async function pickNodeMessage(
  node: FlowNodeRow,
  usageOverlay?: Record<string, number>,
): Promise<BotMessageRow | null> {
  for (const variant of nodeVariants(node)) {
    if (!variant?.message_id) continue;
    const message = await messagesRepository.findById(variant.message_id);
    if (!message) continue;
    const limit = variant.limit ?? message.ab_limit ?? 0;
    const used = (message.ab_used_count ?? 0) + (usageOverlay?.[message.id] ?? 0);
    if (used < limit) return message;
  }
  return node.message_id ? messagesRepository.findById(node.message_id) : null;
}

export interface EntryMessage {
  node: FlowNodeRow;
  message: BotMessageRow;
}

export async function resolveEntryFromGraph(
  graph: LoadedGraph,
  usageOverlay?: Record<string, number>,
): Promise<EntryMessage | null> {
  const start = [...graph.nodes.values()].find((node) => node.type === "start");
  if (!start) return null;
  const entry = findTarget(graph, start.id, "next");
  if (!entry || entry.type !== "message") return null;
  const message = await pickNodeMessage(entry, usageOverlay);
  return message ? { node: entry, message } : null;
}

/** Primeira mensagem do fluxo (substitui o antigo pickMessage do builder). */
export async function resolveEntryMessage(
  campaignId: string,
  usageOverlay?: Record<string, number>,
): Promise<EntryMessage | null> {
  const graph = await loadGraph(campaignId);
  if (!graph) return null;
  return resolveEntryFromGraph(graph, usageOverlay);
}

function parseTimeOnDate(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Próximo horário válido de envio: agora se ainda estamos na janela de um dia
 * habilitado, senão o início da janela do próximo dia habilitado. Follow-ups
 * não consomem o limite diário de leads novos — só respeitam a janela.
 */
function computeNextSendTime(campaign: ProspectingCampaignRow, from: Date): Date {
  for (let offset = 0; offset < 8; offset++) {
    const day = new Date(from);
    day.setDate(day.getDate() + offset);
    const dayConfig = campaign.schedule[WEEKDAY_KEYS[day.getDay()]];
    if (!dayConfig?.enabled) continue;

    const windowStart = parseTimeOnDate(day, campaign.window_start);
    const windowEnd = parseTimeOnDate(day, campaign.window_end);

    if (offset === 0) {
      if (from.getTime() <= windowEnd.getTime()) {
        return from.getTime() > windowStart.getTime() ? from : windowStart;
      }
      continue;
    }
    return windowStart;
  }
  return from;
}

async function setState(
  ctx: ChainContext,
  nodeId: string | null,
  status: leadFlowStateRepository.LeadFlowStatus,
  waitUntil: string | null = null,
): Promise<void> {
  await leadFlowStateRepository.upsertState({
    lead_id: ctx.leadId,
    prospecting_campaign_id: ctx.campaign.id,
    flow_id: ctx.graph.flow.id,
    current_node_id: nodeId,
    status,
    wait_until: waitUntil,
    last_dispatch_id: ctx.lastDispatchId ?? null,
  });
}

async function executeAction(ctx: ChainContext, node: FlowNodeRow): Promise<void> {
  const config = node.config as { kind?: string; column_id?: string; status?: string };
  if (config.kind === "move_kanban" && config.column_id) {
    const patch: Record<string, unknown> = { column_id: config.column_id };
    if (config.status) patch.status = config.status;
    await leadsRepository.update(ctx.leadId, patch);
  }
}

function resolveRouterHandle(graph: LoadedGraph, node: FlowNodeRow, intent: string | null | undefined): string {
  if (intent && graph.edges.some((e) => e.source_node_id === node.id && e.source_handle === intent)) {
    return intent;
  }
  return "fallback";
}

/**
 * Caminha o grafo a partir de (nó, saída) até estacionar o lead em algum
 * lugar: mensagem enfileirada/enviada, timer de espera, aguardando resposta,
 * ou fim do fluxo.
 */
async function followChain(ctx: ChainContext, fromNodeId: string, handle: string): Promise<void> {
  let current = findTarget(ctx.graph, fromNodeId, handle);

  for (let hops = 0; hops < MAX_CHAIN_HOPS; hops++) {
    if (!current) {
      await setState(ctx, null, "completed");
      return;
    }

    if (current.type === "message") {
      const message = await pickNodeMessage(current);
      if (!message) {
        await botLogs.create(
          `Nó de mensagem sem mensagem válida no fluxo. Fluxo encerrado para o lead.`,
          "warn",
          ctx.campaign.id,
        );
        await setState(ctx, current.id, "stopped");
        return;
      }

      if (ctx.mode === "immediate" && ctx.instanceName && ctx.phone) {
        const client = getEvolutionClient();
        await sendMessageBlocks(client, ctx.instanceName, ctx.phone, message.bot_message_blocks);
        if (nodeVariants(current).some((v) => v.message_id === message.id)) {
          await messagesRepository.incrementAbUsedCount(message.id);
        }
        const row = await queueRepository.insertOne({
          prospecting_campaign_id: ctx.campaign.id,
          lead_id: ctx.leadId,
          channel: "whatsapp",
          message_id: message.id,
          flow_node_id: current.id,
          scheduled_at: new Date().toISOString(),
          status: "sent",
          sent_at: new Date().toISOString(),
        });
        ctx.lastDispatchId = row.id;
        await botLogs.create(`Resposta do fluxo "${message.title}" enviada.`, "info", ctx.campaign.id);
        const nextFromMessage: FlowNodeRow | null = findTarget(ctx.graph, current.id, "next");
        current = nextFromMessage;
        continue;
      }

      const scheduledAt = computeNextSendTime(ctx.campaign, new Date());
      const row = await queueRepository.insertOne({
        prospecting_campaign_id: ctx.campaign.id,
        lead_id: ctx.leadId,
        channel: "whatsapp",
        message_id: message.id,
        flow_node_id: current.id,
        scheduled_at: scheduledAt.toISOString(),
        status: "waiting",
      });
      ctx.lastDispatchId = row.id;
      await setState(ctx, current.id, "waiting_dispatch");
      return;
    }

    if (current.type === "wait") {
      const hours = (current.config as { hours?: number | null } | undefined)?.hours ?? null;
      const waitUntil = hours === null ? null : new Date(Date.now() + hours * 3_600_000).toISOString();
      await setState(ctx, current.id, "waiting_timer", waitUntil);
      return;
    }

    if (current.type === "intent_router") {
      if (ctx.mode === "immediate") {
        // Chegou aqui processando uma resposta: roteia pela intenção agora
        const routerHandle = resolveRouterHandle(ctx.graph, current, ctx.intent);
        current = findTarget(ctx.graph, current.id, routerHandle);
        continue;
      }
      // Chegou aqui após um envio/timer: o lead fica aguardando a resposta
      await setState(ctx, current.id, "waiting_timer", null);
      return;
    }

    if (current.type === "action") {
      await executeAction(ctx, current);
      const config = current.config as { kind?: string };
      if (config.kind === "end") {
        await setState(ctx, current.id, "completed");
        return;
      }
      current = findTarget(ctx.graph, current.id, "next");
      continue;
    }

    // start (ou tipo desconhecido): só segue adiante
    current = findTarget(ctx.graph, current.id, "next");
  }

  await botLogs.create(
    `Fluxo excedeu ${MAX_CHAIN_HOPS} passos seguidos (possível ciclo). Fluxo encerrado para o lead.`,
    "warn",
    ctx.campaign.id,
  );
  await setState(ctx, null, "stopped");
}

/**
 * Chamado pelo dispatcher depois de marcar um item como "sent": credita a
 * variante A/B usada e avança o lead para o próximo nó do grafo.
 */
export async function advanceAfterSend(item: {
  id: string;
  prospecting_campaign_id: string;
  lead_id: string;
  message_id: string | null;
  flow_node_id?: string | null;
}): Promise<void> {
  if (!item.flow_node_id) return;

  const graph = await loadGraph(item.prospecting_campaign_id);
  if (!graph) return;
  const node = graph.nodes.get(item.flow_node_id);
  if (!node) return;

  if (item.message_id && nodeVariants(node).some((v) => v.message_id === item.message_id)) {
    await messagesRepository.incrementAbUsedCount(item.message_id);
  }

  const campaign = await campaignsRepository.findById(item.prospecting_campaign_id);
  if (!campaign) return;

  await followChain(
    { graph, campaign, leadId: item.lead_id, mode: "enqueue", lastDispatchId: item.id },
    node.id,
    "next",
  );
}

/**
 * Tick de 60s: dispara os follow-ups cujo timer venceu (saída "no_reply" dos
 * nós de espera). Só roda para campanhas ativas com instância conectada —
 * campanha pausada não dispara nada; ao reativar, timers vencidos disparam
 * no próximo tick.
 */
export async function runFlowTick(): Promise<void> {
  const campaigns = await campaignsRepository.findActiveWithConnectedInstance();

  for (const campaign of campaigns) {
    const dueStates = await leadFlowStateRepository.findDueTimers(campaign.id, new Date().toISOString());
    if (dueStates.length === 0) continue;

    const graph = await loadGraph(campaign.id);

    for (const state of dueStates) {
      const claimed = await leadFlowStateRepository.claimTimer(state.id);
      if (!claimed) continue;

      try {
        const node = state.current_node_id ? graph?.nodes.get(state.current_node_id) : null;
        if (!graph || !node) {
          await leadFlowStateRepository.updateState(state.id, { status: "stopped" });
          continue;
        }
        await followChain(
          { graph, campaign, leadId: state.lead_id, mode: "enqueue" },
          node.id,
          "no_reply",
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        await leadFlowStateRepository.updateState(state.id, { status: "stopped" });
        await botLogs.create(`Falha ao processar follow-up do lead ${state.lead_id}: ${message}`, "error", campaign.id);
      }
    }
  }
}

/**
 * Chamado pelo webhook quando chega resposta humana: avança o lead pelo ramo
 * "replied" (nó de espera) ou pela saída da intenção (roteador). Mensagens no
 * caminho são enviadas imediatamente — a pessoa está com o WhatsApp aberto.
 */
export async function handleReply(input: {
  leadId: string;
  campaignId: string;
  instanceName: string;
  phone: string;
  intent?: string | null;
}): Promise<void> {
  const state = await leadFlowStateRepository.findByLeadAndCampaign(input.leadId, input.campaignId);
  if (!state || state.status === "completed" || state.status === "stopped") return;

  const [graph, campaign] = await Promise.all([
    loadGraph(input.campaignId),
    campaignsRepository.findById(input.campaignId),
  ]);
  if (!graph || !campaign) return;

  const node = state.current_node_id ? graph.nodes.get(state.current_node_id) : null;
  if (!node) {
    await leadFlowStateRepository.updateState(state.id, { status: "stopped" });
    return;
  }

  const ctx: ChainContext = {
    graph,
    campaign,
    leadId: input.leadId,
    mode: "immediate",
    instanceName: input.instanceName,
    phone: input.phone,
    intent: input.intent ?? null,
  };

  if (node.type === "wait") {
    await followChain(ctx, node.id, "replied");
    return;
  }

  if (node.type === "intent_router") {
    await followChain(ctx, node.id, resolveRouterHandle(graph, node, ctx.intent));
    return;
  }

  if (node.type === "message" && state.status === "waiting_dispatch") {
    // Respondeu antes do follow-up agendado sair: cancela o envio pendente
    // e encerra o fluxo — a conversa agora é ao vivo, em Negociação.
    await queueRepository.removeWaitingForLead(input.leadId, input.campaignId);
    await leadFlowStateRepository.updateState(state.id, { status: "completed" });
    await botLogs.create(`Lead respondeu antes do follow-up agendado — envio cancelado.`, "info", campaign.id);
  }
}
