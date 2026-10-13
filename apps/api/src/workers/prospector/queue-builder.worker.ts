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
  // Campanha manual (padrão): o bot só fala com os leads que o usuário enviou/planejou.
  // O preenchimento automático por cidade/segmento só roda com o interruptor ligado.
  const autoFill = campaign.filters?.autoFill === true;
  const autoCandidates = autoFill && remainingSlots > 0
    ? await leadsRepository.findProspectingCandidates(campaign.filters, excludeIds)
    : [];

  const selected = [...plannedLeads, ...autoCandidates.slice(0, remainingSlots)];

  if (selected.length === 0) {
    await botLogs.create(
      autoFill
        ? `[${campaign.name}] Nenhum lead candidato encontrado para hoje.`
        : `[${campaign.name}] Nenhum lead planejado para hoje (campanha manual).`,
      "info",
      campaign.id,
    );
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
  if (lead.status !== "novo") {
    return { ok: false, reason: 'Só leads em "A Prospectar" podem entrar na fila do bot.' };
  }

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


export interface BatchDispatchResult {
  /** Entraram na fila de hoje. */
  queuedToday: number;
  /** Não couberam hoje (limite/janela) ou foram pedidos para outro dia: ficaram planejados. */
  planned: { date: string; count: number }[];
  /** Não entraram, com o motivo (sem WhatsApp, já em outra campanha...). */
  skipped: { leadId: string; reason: string }[];
}

const PLAN_LOOKAHEAD_DAYS = 14;

/**
 * Envia para o bot os leads ESCOLHIDOS pelo usuário (ex.: 20 dos 50 do painel).
 *
 * Diferente de repetir enqueueLeadNow, aqui:
 *  - a rotação A/B enxerga as variantes já enfileiradas (usageOverlay parte das linhas
 *    "waiting" da campanha), senão os N leads cairiam todos na primeira variante;
 *  - respeita o limite do dia e a janela de envio — o dispatcher não checa a janela, então
 *    sem isso um lote grande poderia sair de madrugada. O que não cabe hoje vira
 *    dispatch_plan nos próximos dias habilitados;
 *  - com `date` futura, só planeja (o build diário daquele dia enfileira com o A/B correto).
 */
export async function enqueueLeadsBatch(
  campaignId: string,
  leadIds: string[],
  date?: string,
): Promise<BatchDispatchResult> {
  const campaign = await campaignsRepository.findById(campaignId);
  if (!campaign) throw new Error("Campanha não encontrada.");

  const result: BatchDispatchResult = { queuedToday: 0, planned: [], skipped: [] };
  const skip = (leadId: string, reason: string) => result.skipped.push({ leadId, reason });
  const skipAll = (leads: { id: string }[], reason: string) => leads.forEach((lead) => skip(lead.id, reason));

  // 1) Quem pode entrar
  const alreadyQueuedIds = new Set(await queueRepository.findLeadIdsQueuedToday());
  const eligible: { id: string; name: string }[] = [];
  for (const leadId of new Set(leadIds)) {
    const lead = await leadsRepository.findById(leadId);
    if (!lead) {
      skip(leadId, "Lead não encontrado.");
    } else if (!lead.whatsapp) {
      skip(leadId, "Lead sem WhatsApp cadastrado.");
    } else if (lead.status !== "novo") {
      skip(leadId, 'Só leads em "A Prospectar" podem entrar na fila do bot.');
    } else if (lead.prospecting_campaign_id && lead.prospecting_campaign_id !== campaignId) {
      const other = await campaignsRepository.findById(lead.prospecting_campaign_id);
      skip(leadId, `Este lead já está na campanha "${other?.name ?? "outra"}".`);
    } else if (alreadyQueuedIds.has(leadId)) {
      skip(leadId, "Lead já está na fila de hoje.");
    } else {
      eligible.push({ id: lead.id, name: lead.name });
    }
  }
  if (eligible.length === 0) return result;

  const now = new Date();
  const todayKey = toDateKey(now);

  // 2) Dia futuro: só planeja
  if (date && date > todayKey) {
    let count = 0;
    for (const lead of eligible) {
      if (await planLead(lead.id, campaignId, date)) count++;
      else skip(lead.id, "Este lead já foi reivindicado por outra campanha.");
    }
    if (count > 0) result.planned.push({ date, count });
    await logBatch(campaign.name, campaign.id, result);
    return result;
  }

  // 3) Hoje
  const instance = await prospectorRepository.findInstanceByChannel("whatsapp", campaign.owner_user_id);
  if (!instance || instance.status !== "connected") {
    skipAll(eligible, "Instância WhatsApp não conectada.");
    return result;
  }
  const graph = await loadGraph(campaign.id);
  if (!graph) {
    skipAll(eligible, "Nenhum fluxo de mensagens configurado.");
    return result;
  }

  const dayConfig = campaign.schedule[WEEKDAY_KEYS[now.getDay()]];
  const effectiveLimit = dayConfig ? getEffectiveDailyLimit(instance, dayConfig) : 0;
  const { minIntervalMs, jitterMs } = getDispatchInterval(instance, effectiveLimit);
  const windowEnd = parseTimeOnDate(now, campaign.window_end);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const history = await queueRepository.findAllForCampaign(campaignId);
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const todayRows = history.filter((row) => new Date(row.created_at) >= startOfDay);
  // Conservador: tudo que já nasceu hoje (inclusive follow-up) consome o limite do dia.
  const slotsToday = Math.max(0, effectiveLimit - todayRows.length);
  // Follow-ups agendados pra outros dias não podem empurrar o lote pra frente.
  const lastScheduledToday = todayRows.reduce<number | null>((max, row) => {
    const t = new Date(row.scheduled_at).getTime();
    return t <= endOfDay.getTime() && (max === null || t > max) ? t : max;
  }, null);

  const usageOverlay: Record<string, number> = {};
  for (const row of history) {
    if ((row.status === "waiting" || row.status === "sending") && row.message_id) {
      usageOverlay[row.message_id] = (usageOverlay[row.message_id] ?? 0) + 1;
    }
  }

  const rows: Record<string, unknown>[] = [];
  const entryNodeByLeadId = new Map<string, string>();
  const claimedIds: string[] = [];
  let cursor = Math.max(now.getTime(), lastScheduledToday !== null ? lastScheduledToday + minIntervalMs : 0);

  let next = 0;
  for (; next < eligible.length; next++) {
    if (claimedIds.length >= slotsToday) break;
    const scheduledAt = new Date(Math.max(now.getTime(), cursor + randomJitter(jitterMs)));
    if (scheduledAt.getTime() > windowEnd.getTime()) break;

    const lead = eligible[next];
    const entry = await resolveEntryFromGraph(graph, usageOverlay);
    if (!entry) {
      skipAll(eligible.slice(next), "Fluxo sem mensagem inicial configurada.");
      next = eligible.length;
      break;
    }
    if (!(await leadsRepository.claimForCampaign(lead.id, campaignId))) {
      skip(lead.id, "Este lead já foi reivindicado por outra campanha.");
      continue;
    }

    claimedIds.push(lead.id);
    entryNodeByLeadId.set(lead.id, entry.node.id);
    usageOverlay[entry.message.id] = (usageOverlay[entry.message.id] ?? 0) + 1;
    rows.push({
      prospecting_campaign_id: campaignId,
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
      prospecting_campaign_id: campaignId,
      flow_id: graph.flow.id,
      current_node_id: nodeId,
      status: "waiting_dispatch",
    });
  }
  await planRepository.removeMany(claimedIds);
  result.queuedToday = rows.length;

  // 4) O que não coube hoje (limite ou janela) vai pros próximos dias habilitados
  const overflow = eligible.slice(next);
  if (overflow.length > 0) {
    const plannedByDate = new Map<string, number>();
    for (const row of await planRepository.findAll(campaignId)) {
      plannedByDate.set(row.planned_date, (plannedByDate.get(row.planned_date) ?? 0) + 1);
    }

    let pending = [...overflow];
    for (let offset = 1; offset <= PLAN_LOOKAHEAD_DAYS && pending.length > 0; offset++) {
      const day = new Date(now);
      day.setDate(day.getDate() + offset);
      const dayKey = toDateKey(day);
      const config = campaign.schedule[WEEKDAY_KEYS[day.getDay()]];
      const capacity = config ? getEffectiveDailyLimit(instance, config) - (plannedByDate.get(dayKey) ?? 0) : 0;
      if (capacity <= 0) continue;

      let count = 0;
      const rest: typeof pending = [];
      for (const lead of pending) {
        if (count >= capacity) rest.push(lead);
        else if (await planLead(lead.id, campaignId, dayKey)) count++;
        else skip(lead.id, "Este lead já foi reivindicado por outra campanha.");
      }
      if (count > 0) result.planned.push({ date: dayKey, count });
      pending = rest;
    }
    skipAll(pending, `Nenhum dia com vaga na agenda nos próximos ${PLAN_LOOKAHEAD_DAYS} dias.`);
  }

  await logBatch(campaign.name, campaign.id, result);
  return result;
}

/** Reivindica o lead, cancela envio pendente dele e agenda no dia. false se é de outra campanha. */
async function planLead(leadId: string, campaignId: string, date: string): Promise<boolean> {
  if (!(await leadsRepository.claimForCampaign(leadId, campaignId))) return false;
  await queueRepository.removeWaitingForLead(leadId, campaignId);
  await planRepository.assign(leadId, date, campaignId);
  return true;
}

async function logBatch(campaignName: string, campaignId: string, result: BatchDispatchResult) {
  const planned = result.planned.reduce((sum, p) => sum + p.count, 0);
  await botLogs.create(
    `[${campaignName}] Envio manual: ${result.queuedToday} na fila de hoje, ${planned} planejados, ${result.skipped.length} ignorados.`,
    "info",
    campaignId,
  );
}
