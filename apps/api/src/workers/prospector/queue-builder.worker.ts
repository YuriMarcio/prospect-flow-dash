import * as prospectorRepository from "../../modules/prospector/prospector.repository";
import * as queueRepository from "../../modules/prospector/queue.repository";
import * as leadFlowStateRepository from "../../modules/prospector/lead-flow-state.repository";
import * as planRepository from "../../modules/prospector/plan.repository";
import * as botLogs from "../../modules/prospector/botlogs.repository";
import * as leadsRepository from "../../modules/leads/leads.repository";
import * as campaignsRepository from "../../modules/prospecting-campaigns/prospecting-campaigns.repository";
import type { ProspectingCampaignRow } from "../../modules/prospecting-campaigns/prospecting-campaigns.repository";
import { getEffectiveDailyLimit, getDispatchInterval } from "./warming";
import { loadGraph, resolveEntryFromGraph, resolveEntryMessage } from "./flow-engine";

const WEEKDAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function randomJitter(jitterMs: number): number {
  return Math.round((Math.random() * 2 - 1) * jitterMs);
}

function parseTimeOnDate(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Constrói a fila do dia para uma campanha específica. Leads colocados
 * manualmente em "Hoje" (dispatch_plan) têm prioridade total e entram sem
 * passar pelos filtros de cidade/segmento — só depois disso o restante das
 * vagas é preenchido pela seleção automática. A lista de leads já enfileirados
 * hoje é GLOBAL (todas as campanhas), pra duas campanhas não mandarem mensagem
 * pro mesmo lead compartilhado no mesmo dia. Um lead só pode pertencer a uma
 * campanha por vez — reivindicado atomicamente no momento do envio.
 */
export async function buildTodayQueue(campaign: ProspectingCampaignRow): Promise<{ queued: number }> {
  const today = new Date();
  const dayKey = WEEKDAY_KEYS[today.getDay()];
  const dayConfig = campaign.schedule[dayKey];

  if (!dayConfig || !dayConfig.enabled) {
    await botLogs.create(`[${campaign.name}] Dia "${dayKey}" desabilitado na agenda. Fila não construída.`, "info", campaign.id);
    return { queued: 0 };
  }

  const instance = await prospectorRepository.findInstanceByChannel("whatsapp", campaign.owner_user_id);
  if (!instance || instance.status !== "connected") {
    await botLogs.create(`[${campaign.name}] Instância WhatsApp não conectada. Fila não construída.`, "warn", campaign.id);
    return { queued: 0 };
  }

  const effectiveLimit = getEffectiveDailyLimit(instance, dayConfig);
  if (effectiveLimit <= 0) {
    await botLogs.create(`[${campaign.name}] Limite efetivo do dia é 0. Fila não construída.`, "info", campaign.id);
    return { queued: 0 };
  }

  const todayKey = toDateKey(today);
  const plannedToday = await planRepository.findByDate(todayKey, campaign.id);
  const alreadyQueuedIds = await queueRepository.findLeadIdsQueuedToday();

  const plannedLeads = [];
  for (const plan of plannedToday) {
    if (alreadyQueuedIds.includes(plan.lead_id)) continue;
    const lead = await leadsRepository.findById(plan.lead_id);
    if (lead?.whatsapp) plannedLeads.push(lead as { id: string; name: string; whatsapp: string });
  }

  const remainingSlots = Math.max(0, effectiveLimit - plannedLeads.length);
  const excludeIds = [...alreadyQueuedIds, ...plannedLeads.map((l) => l.id)];
  const autoCandidates = remainingSlots > 0
    ? await leadsRepository.findProspectingCandidates(campaign.filters, excludeIds)
    : [];

  const selected = [...plannedLeads, ...autoCandidates.slice(0, remainingSlots)];

  if (selected.length === 0) {
    await botLogs.create(`[${campaign.name}] Nenhum lead candidato encontrado para hoje.`, "info", campaign.id);
    return { queued: 0 };
  }

  const graph = await loadGraph(campaign.id);
  if (!graph) {
    await botLogs.create(`[${campaign.name}] Nenhum fluxo de mensagens configurado. Fila não construída.`, "warn", campaign.id);
    return { queued: 0 };
  }

  const { minIntervalMs, jitterMs } = getDispatchInterval(instance, effectiveLimit);
  const windowStart = parseTimeOnDate(today, campaign.window_start);
  const windowEnd = parseTimeOnDate(today, campaign.window_end);

  const rows: Record<string, unknown>[] = [];
  const claimedLeadIds: string[] = [];
  const entryNodeByLeadId = new Map<string, string>();
  // Usos de variantes A/B atribuídos neste build (ainda não persistidos),
  // pra rotação distribuir entre os leads do dia.
  const usageOverlay: Record<string, number> = {};
  let cursor = windowStart.getTime();

  for (const lead of selected) {
    const scheduledAt = new Date(cursor + randomJitter(jitterMs));
    if (scheduledAt.getTime() > windowEnd.getTime()) break;

    const entry = await resolveEntryFromGraph(graph, usageOverlay);
    if (!entry) {
      await botLogs.create(`[${campaign.name}] Fluxo sem mensagem inicial configurada. Fila não construída.`, "warn", campaign.id);
      break;
    }

    const claimed = await leadsRepository.claimForCampaign(lead.id, campaign.id);
    if (!claimed) {
      // Já foi reivindicado por outra campanha entre a seleção e agora — pula sem gastar o slot.
      continue;
    }
    claimedLeadIds.push(lead.id);
    entryNodeByLeadId.set(lead.id, entry.node.id);
    usageOverlay[entry.message.id] = (usageOverlay[entry.message.id] ?? 0) + 1;

    rows.push({
      prospecting_campaign_id: campaign.id,
      lead_id: lead.id,
      channel: "whatsapp",
      message_id: entry.message.id,
      flow_node_id: entry.node.id,
      scheduled_at: scheduledAt.toISOString(),
      status: "waiting",
    });

    cursor += minIntervalMs;
  }

  await queueRepository.insertMany(rows);

  for (const [leadId, nodeId] of entryNodeByLeadId) {
    await leadFlowStateRepository.upsertState({
      lead_id: leadId,
      prospecting_campaign_id: campaign.id,
      flow_id: graph.flow.id,
      current_node_id: nodeId,
      status: "waiting_dispatch",
    });
  }

  await planRepository.removeMany(plannedLeads.filter((l) => claimedLeadIds.includes(l.id)).map((l) => l.id));
  await botLogs.create(
    `[${campaign.name}] Fila construída: ${rows.length} leads agendados para hoje (${plannedLeads.length} planejados manualmente).`,
    "info",
    campaign.id,
  );
  return { queued: rows.length };
}

/**
 * Roda a construção de fila pra todas as campanhas ativas com instância
 * conectada, uma de cada vez — sequencial de propósito, pra exclusão de leads
 * já enfileirados hoje (compartilhada entre campanhas) refletir o que a
 * campanha anterior acabou de reivindicar.
 */
export async function buildTodayQueueForAllCampaigns(): Promise<{ queued: number }> {
  const campaigns = await campaignsRepository.findActiveWithConnectedInstance();
  let total = 0;
  for (const campaign of campaigns) {
    const result = await buildTodayQueue(campaign);
    total += result.queued;
  }
  return { queued: total };
}

/**
 * Enfileira um lead imediatamente para hoje (arraste manual na coluna "Hoje"
 * do kanban de uma campanha). Ignora filtros de cidade/segmento e o limite
 * diário — escolha manual tem prioridade. Bloqueia se o lead já pertencer a
 * outra campanha.
 */
export async function enqueueLeadNow(leadId: string, campaignId: string): Promise<{ ok: boolean; reason?: string }> {
  const lead = await leadsRepository.findById(leadId);
  if (!lead?.whatsapp) return { ok: false, reason: "Lead sem WhatsApp cadastrado." };

  const existingCampaignId = await leadsRepository.findCampaignIdForLead(leadId);
  if (existingCampaignId && existingCampaignId !== campaignId) {
    const other = await campaignsRepository.findById(existingCampaignId);
    return { ok: false, reason: `Este lead já está na campanha "${other?.name ?? "outra"}".` };
  }

  const campaign = await campaignsRepository.findById(campaignId);
  if (!campaign) return { ok: false, reason: "Campanha não encontrada." };

  const alreadyQueuedIds = await queueRepository.findLeadIdsQueuedToday();
  if (alreadyQueuedIds.includes(leadId)) return { ok: false, reason: "Lead já está na fila de hoje." };

  const instance = await prospectorRepository.findInstanceByChannel("whatsapp", campaign.owner_user_id);
  if (!instance || instance.status !== "connected") {
    return { ok: false, reason: "Instância WhatsApp não conectada." };
  }

  const entry = await resolveEntryMessage(campaignId);
  if (!entry) return { ok: false, reason: "Nenhum fluxo com mensagem inicial configurado." };

  const dayConfig = campaign.schedule[WEEKDAY_KEYS[new Date().getDay()]];
  const effectiveLimit = dayConfig ? getEffectiveDailyLimit(instance, dayConfig) : 0;
  const { minIntervalMs, jitterMs } = getDispatchInterval(instance, effectiveLimit);
  const todayQueue = await queueRepository.findAllForToday(campaignId);
  const lastScheduled = todayQueue.reduce<number | null>((max, item) => {
    const t = new Date(item.scheduled_at).getTime();
    return max === null || t > max ? t : max;
  }, null);

  const now = Date.now();
  const baseTime = lastScheduled ? lastScheduled + minIntervalMs : now;
  const scheduledAt = new Date(Math.max(now, baseTime) + randomJitter(jitterMs));

  const claimed = await leadsRepository.claimForCampaign(leadId, campaignId);
  if (!claimed) return { ok: false, reason: "Este lead já foi reivindicado por outra campanha." };

  const row = await queueRepository.insertOne({
    prospecting_campaign_id: campaignId,
    lead_id: leadId,
    channel: "whatsapp",
    message_id: entry.message.id,
    flow_node_id: entry.node.id,
    scheduled_at: scheduledAt.toISOString(),
    status: "waiting",
  });

  await leadFlowStateRepository.upsertState({
    lead_id: leadId,
    prospecting_campaign_id: campaignId,
    flow_id: entry.node.flow_id,
    current_node_id: entry.node.id,
    status: "waiting_dispatch",
    last_dispatch_id: row.id,
  });

  await planRepository.unassign(leadId);
  await botLogs.create(`${lead.name} adicionado manualmente à fila de hoje (${campaign.name}).`, "info", campaign.id);
  return { ok: true };
}
