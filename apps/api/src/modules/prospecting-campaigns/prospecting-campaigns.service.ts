import * as campaignsRepository from "./prospecting-campaigns.repository";
import * as prospectorRepository from "../prospector/prospector.repository";
import * as queueRepository from "../prospector/queue.repository";
import * as messagesRepository from "../prospector/messages.repository";
import * as planRepository from "../prospector/plan.repository";
import * as botLogs from "../prospector/botlogs.repository";
import * as leadsRepository from "../leads/leads.repository";
import * as leadFlowStateRepository from "../prospector/lead-flow-state.repository";
import { loadGraph, resolveEntryFromGraph } from "../../workers/prospector/flow-engine";
import { enqueueLeadsBatch } from "../../workers/prospector/queue-builder.worker";
import { getDispatchInterval, getEffectiveDailyLimit, isWarmingDone } from "../../workers/prospector/warming";
import {
  startSessionForCampaign,
  stopSessionForCampaign,
} from "../../workers/prospector/session.worker";

const WEEKDAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;

const DEFAULT_SCHEDULE = {
  dom: { enabled: false, limit: 0 },
  seg: { enabled: true, limit: 80 },
  ter: { enabled: true, limit: 80 },
  qua: { enabled: true, limit: 80 },
  qui: { enabled: true, limit: 80 },
  sex: { enabled: true, limit: 80 },
  sab: { enabled: false, limit: 0 },
};

export async function listCampaignsService() {
  return campaignsRepository.findAll();
}

export async function getCampaignService(id: string) {
  const campaign = await campaignsRepository.findById(id);
  if (!campaign) throw new Error("Campanha não encontrada.");
  return campaign;
}

export async function createCampaignService(input: {
  name: string;
  ownerUserId: string;
  createdByUserId: string;
  region?: string | null;
  segment?: string | null;
  filters?: { cities: string[]; segments: string[]; autoFill?: boolean };
  schedule?: Record<string, { enabled: boolean; limit: number }>;
  windowStart?: string;
  windowEnd?: string;
}) {
  return campaignsRepository.create({
    name: input.name,
    ownerUserId: input.ownerUserId,
    createdByUserId: input.createdByUserId,
    region: input.region ?? null,
    segment: input.segment ?? null,
    filters: input.filters ?? { cities: [], segments: [] },
    schedule: input.schedule ?? DEFAULT_SCHEDULE,
    windowStart: input.windowStart ?? "08:00",
    windowEnd: input.windowEnd ?? "18:00",
  });
}

export async function updateCampaignService(id: string, patch: Record<string, unknown>) {
  return campaignsRepository.update(id, patch);
}

export async function toggleCampaignService(id: string) {
  return campaignsRepository.toggleActive(id);
}

export async function deleteCampaignService(id: string) {
  const campaign = await campaignsRepository.findById(id);
  if (!campaign) throw new Error("Campanha não encontrada.");

  await leadsRepository.releaseCampaign(id);
  await messagesRepository.removeAllForCampaign(id);
  await queueRepository.removeAllForCampaign(id);
  await planRepository.removeAllForCampaign(id);
  await botLogs.detachCampaign(id);
  await campaignsRepository.remove(id);
}

export async function getCampaignStatusService(campaignId: string) {
  const campaign = await campaignsRepository.findById(campaignId);
  if (!campaign) throw new Error("Campanha não encontrada.");

  const instance = await prospectorRepository.findInstanceByChannel("whatsapp", campaign.owner_user_id);
  const connected = instance?.status === "connected";

  const todayKey = WEEKDAY_KEYS[new Date().getDay()];
  const dayConfig = campaign.schedule[todayKey];
  const todayLimit = instance && dayConfig ? getEffectiveDailyLimit(instance, dayConfig) : 0;
  const todayCount = await queueRepository.countToday(campaignId, "sent");
  const queueSize = await queueRepository.countToday(campaignId, "waiting");

  // Mensagem inicial vem do fluxo (canvas), não mais do status "active"
  const graph = await loadGraph(campaignId);
  const entry = graph ? await resolveEntryFromGraph(graph) : null;
  const followupCount = await leadFlowStateRepository.countByStatus(campaignId, "waiting_timer");

  // Previsão de término: intervalo efetivo + último envio agendado para hoje
  const intervalMs = instance ? getDispatchInterval(instance, todayLimit).minIntervalMs : null;
  const queueRemaining = await queueRepository.countWaitingDueToday(campaignId);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const todayRows = await queueRepository.findAllForToday(campaignId);
  const lastWaiting = todayRows
    .filter((row) => row.status === "waiting" && new Date(row.scheduled_at) <= endOfDay)
    .at(-1);

  return {
    forecast: {
      intervalMs,
      queueRemaining,
      estimatedFinishAt: lastWaiting?.scheduled_at ?? null,
    },
    connected,
    is_active: campaign.is_active,
    todayCount,
    todayLimit,
    queueSize,
    activeMessage: entry?.message ?? null,
    hasFlow: Boolean(graph),
    followupCount,
    warmingDone: instance ? isWarmingDone(instance) : true,
    filters: campaign.filters,
    sessionMode: campaign.session_mode,
    sessionStartAt: campaign.session_start_at,
    sessionEndAt: campaign.session_end_at,
  };
}

/**
 * Métricas acumuladas da campanha (painel do Kanban): totais de envio e
 * resposta, taxa de resposta real, tempo médio de resposta, intenções
 * detectadas pela IA e oportunidades quentes.
 */
export async function getCampaignMetricsService(campaignId: string) {
  const campaign = await campaignsRepository.findById(campaignId);
  if (!campaign) throw new Error("Campanha não encontrada.");

  const rows = await queueRepository.findMetricsRows(campaignId);

  let sent = 0;
  let replied = 0;
  let failed = 0;
  let hotLeads = 0;
  let responseTimeSumMs = 0;
  let responseTimeCount = 0;
  const intents: Record<string, number> = {};

  for (const row of rows) {
    if (row.status === "sent" || row.status === "replied") sent++;
    if (row.status === "failed") failed++;
    if (row.status === "replied") {
      replied++;
      if (row.sent_at && row.response_at) {
        const elapsed = new Date(row.response_at).getTime() - new Date(row.sent_at).getTime();
        if (elapsed > 0) {
          responseTimeSumMs += elapsed;
          responseTimeCount++;
        }
      }
    }
    if (row.response_intent) {
      intents[row.response_intent] = (intents[row.response_intent] ?? 0) + 1;
    }
    if (row.response_ai?.prontidao_para_reuniao === "alta") hotLeads++;
  }

  const [inNegotiation, followupsPending] = await Promise.all([
    leadsRepository.countByCampaignAndStatus(campaignId, "negociacao"),
    leadFlowStateRepository.countByStatus(campaignId, "waiting_timer"),
  ]);

  return {
    total: {
      sent,
      replied,
      responseRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
      failed,
      inNegotiation,
      followupsPending,
    },
    avgResponseMs: responseTimeCount > 0 ? Math.round(responseTimeSumMs / responseTimeCount) : null,
    intents,
    hotLeads,
  };
}

/**
 * "Cancelar envios pendentes": esvazia a fila e o plano e para os fluxos em andamento.
 * Os leads CONTINUAM na campanha (ela é um painel permanente do território) e o histórico
 * de enviados e respondidos permanece na dispatch_queue. Pra tirar um lead da campanha,
 * use removeLeadFromCampaignService.
 */
export async function clearCampaignLeadsService(campaignId: string) {
  const campaign = await campaignsRepository.findById(campaignId);
  if (!campaign) throw new Error("Campanha não encontrada.");

  await queueRepository.removeWaitingForCampaign(campaignId);
  await planRepository.removeAllForCampaign(campaignId);
  await leadFlowStateRepository.stopAllForCampaign(campaignId);

  await botLogs.create("Envios pendentes cancelados (fila e plano esvaziados).", "info", campaignId);
  return { ok: true };
}

export type CampaignLeadBotStatus = "none" | "planned" | "queued" | "sent" | "replied" | "failed";

/**
 * Leads do painel da campanha, cada um com a situação no bot (derivada da fila e do plano):
 * replied > sent > queued (1ª mensagem aguardando) > failed > planned (dia futuro) > none.
 */
export async function listCampaignLeadsService(campaignId: string) {
  const campaign = await campaignsRepository.findById(campaignId);
  if (!campaign) throw new Error("Campanha não encontrada.");

  const [leads, queue, plan] = await Promise.all([
    leadsRepository.findByProspectingCampaign(campaignId),
    queueRepository.findAllForCampaign(campaignId),
    planRepository.findAll(campaignId),
  ]);

  const queueByLead = new Map<string, typeof queue>();
  for (const row of queue) queueByLead.set(row.lead_id, [...(queueByLead.get(row.lead_id) ?? []), row]);
  const planByLead = new Map(plan.map((row) => [row.lead_id, row.planned_date]));

  return leads.map((lead: Record<string, unknown> & { id: string }) => {
    const rows = queueByLead.get(lead.id) ?? [];
    const has = (...statuses: string[]) => rows.some((row) => statuses.includes(row.status));
    const waiting = rows.filter((row) => row.status === "waiting" || row.status === "sending");

    let status: CampaignLeadBotStatus = "none";
    let date: string | null = null;
    if (has("replied")) status = "replied";
    else if (has("sent")) status = "sent";
    else if (waiting.length > 0) {
      status = "queued";
      date = waiting[0].scheduled_at;
    } else if (has("failed")) status = "failed";
    else if (planByLead.has(lead.id)) {
      status = "planned";
      date = planByLead.get(lead.id) ?? null;
    }

    return { ...lead, bot: { status, date } };
  });
}

/** Põe no painel da campanha leads que estavam soltos no Kanban geral. */
export async function addLeadsToCampaignService(campaignId: string, leadIds: string[]) {
  const campaign = await campaignsRepository.findById(campaignId);
  if (!campaign) throw new Error("Campanha não encontrada.");

  let added = 0;
  const skipped: { leadId: string; reason: string }[] = [];
  for (const leadId of new Set(leadIds)) {
    if (await leadsRepository.claimForCampaign(leadId, campaignId)) {
      added++;
      continue;
    }
    const otherId = await leadsRepository.findCampaignIdForLead(leadId);
    const other = otherId ? await campaignsRepository.findById(otherId) : null;
    skipped.push({ leadId, reason: `Este lead já está na campanha "${other?.name ?? "outra"}".` });
  }
  return { added, skipped };
}

/** Tira o lead da campanha: cancela o envio pendente dele e devolve ao Kanban geral. */
export async function removeLeadFromCampaignService(campaignId: string, leadId: string) {
  const campaign = await campaignsRepository.findById(campaignId);
  if (!campaign) throw new Error("Campanha não encontrada.");

  await queueRepository.removeWaitingForLead(leadId, campaignId);
  await planRepository.unassign(leadId);
  await leadFlowStateRepository.stopForLead(leadId, campaignId);
  await leadsRepository.removeFromCampaign(leadId, campaignId);
}

/** Manda o bot falar só com os leads escolhidos (hoje ou num dia futuro). */
export async function dispatchLeadsService(campaignId: string, input: { leadIds: string[]; date?: string }) {
  if (!Array.isArray(input.leadIds) || input.leadIds.length === 0) throw new Error("Selecione ao menos um lead.");
  if (input.date && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Data inválida.");
  return enqueueLeadsBatch(campaignId, input.leadIds, input.date);
}

export { startSessionForCampaign as startCampaignSessionService, stopSessionForCampaign as stopCampaignSessionService };
