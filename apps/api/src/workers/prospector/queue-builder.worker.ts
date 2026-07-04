import * as prospectorRepository from "../../modules/prospector/prospector.repository";
import * as messagesRepository from "../../modules/prospector/messages.repository";
import * as queueRepository from "../../modules/prospector/queue.repository";
import * as planRepository from "../../modules/prospector/plan.repository";
import * as botLogs from "../../modules/prospector/botlogs.repository";
import * as leadsRepository from "../../modules/leads/leads.repository";
import { getEffectiveDailyLimit, getDispatchInterval } from "./warming";

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

async function pickMessage(ownerId: string) {
  const abMessage = await messagesRepository.findNextAbTest(ownerId);
  if (abMessage) return abMessage;
  return messagesRepository.findActive(ownerId);
}

/**
 * Constrói a fila do dia para um dono específico. Leads colocados manualmente em
 * "Hoje" (dispatch_plan) têm prioridade total e entram sem passar pelos filtros de
 * cidade/segmento — só depois disso o restante das vagas é preenchido pela seleção
 * automática. A lista de leads já enfileirados hoje é GLOBAL (todos os donos), pra
 * duas pessoas não mandarem mensagem pro mesmo lead compartilhado no mesmo dia.
 */
export async function buildTodayQueue(ownerId: string): Promise<{ queued: number }> {
  const config = await prospectorRepository.getConfig(ownerId);
  const today = new Date();
  const dayKey = WEEKDAY_KEYS[today.getDay()];
  const dayConfig = config.schedule[dayKey];

  if (!dayConfig || !dayConfig.enabled) {
    await botLogs.create(`Dia "${dayKey}" desabilitado na agenda. Fila não construída.`, "info");
    return { queued: 0 };
  }

  const instance = await prospectorRepository.findInstanceByChannel("whatsapp", ownerId);
  if (!instance || instance.status !== "connected") {
    await botLogs.create(`Instância WhatsApp não conectada. Fila não construída.`, "warn");
    return { queued: 0 };
  }

  const effectiveLimit = getEffectiveDailyLimit(instance, dayConfig);
  if (effectiveLimit <= 0) {
    await botLogs.create(`Limite efetivo do dia é 0. Fila não construída.`, "info");
    return { queued: 0 };
  }

  const todayKey = toDateKey(today);
  const plannedToday = await planRepository.findByDate(todayKey, ownerId);
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
    ? await leadsRepository.findProspectingCandidates(config.filters, excludeIds)
    : [];

  const selected = [...plannedLeads, ...autoCandidates.slice(0, remainingSlots)];

  if (selected.length === 0) {
    await botLogs.create(`Nenhum lead candidato encontrado para hoje.`, "info");
    return { queued: 0 };
  }

  const { minIntervalMs, jitterMs } = getDispatchInterval(instance, effectiveLimit);
  const windowStart = parseTimeOnDate(today, config.window_start);
  const windowEnd = parseTimeOnDate(today, config.window_end);

  const rows: Record<string, unknown>[] = [];
  let cursor = windowStart.getTime();

  for (const lead of selected) {
    const scheduledAt = new Date(cursor + randomJitter(jitterMs));
    if (scheduledAt.getTime() > windowEnd.getTime()) break;

    const message = await pickMessage(ownerId);
    if (!message) {
      await botLogs.create(`Nenhuma mensagem ativa configurada. Pulando lead ${lead.name}.`, "warn");
      cursor += minIntervalMs;
      continue;
    }

    rows.push({
      owner_id: ownerId,
      lead_id: lead.id,
      channel: "whatsapp",
      message_id: message.id,
      scheduled_at: scheduledAt.toISOString(),
      status: "waiting",
    });

    cursor += minIntervalMs;
  }

  await queueRepository.insertMany(rows);
  await planRepository.removeMany(plannedLeads.map((l) => l.id));
  await botLogs.create(
    `Fila construída: ${rows.length} leads agendados para hoje (${plannedLeads.length} planejados manualmente).`,
    "info",
  );
  return { queued: rows.length };
}

/**
 * Roda a construção de fila pra todos os donos configurados, um de cada vez —
 * sequencial de propósito, pra exclusão de leads já enfileirados hoje (compartilhada
 * entre donos) refletir o que o dono anterior acabou de reservar.
 */
export async function buildTodayQueueForAllOwners(): Promise<{ queued: number }> {
  const ownerIds = await prospectorRepository.listConfiguredOwnerIds();
  let total = 0;
  for (const ownerId of ownerIds) {
    const result = await buildTodayQueue(ownerId);
    total += result.queued;
  }
  return { queued: total };
}

/**
 * Enfileira um lead imediatamente para hoje (arraste manual na coluna "Hoje").
 * Ignora filtros de cidade/segmento e o limite diário — escolha manual tem prioridade.
 */
export async function enqueueLeadNow(leadId: string, ownerId: string): Promise<{ ok: boolean; reason?: string }> {
  const lead = await leadsRepository.findById(leadId);
  if (!lead?.whatsapp) return { ok: false, reason: "Lead sem WhatsApp cadastrado." };

  const alreadyQueuedIds = await queueRepository.findLeadIdsQueuedToday();
  if (alreadyQueuedIds.includes(leadId)) return { ok: false, reason: "Lead já está na fila de hoje." };

  const instance = await prospectorRepository.findInstanceByChannel("whatsapp", ownerId);
  if (!instance || instance.status !== "connected") {
    return { ok: false, reason: "Instância WhatsApp não conectada." };
  }

  const message = await pickMessage(ownerId);
  if (!message) return { ok: false, reason: "Nenhuma mensagem ativa configurada." };

  const config = await prospectorRepository.getConfig(ownerId);
  const dayConfig = config.schedule[WEEKDAY_KEYS[new Date().getDay()]];
  const effectiveLimit = dayConfig ? getEffectiveDailyLimit(instance, dayConfig) : 0;
  const { minIntervalMs, jitterMs } = getDispatchInterval(instance, effectiveLimit);
  const todayQueue = await queueRepository.findAllForToday(ownerId);
  const lastScheduled = todayQueue.reduce<number | null>((max, item) => {
    const t = new Date(item.scheduled_at).getTime();
    return max === null || t > max ? t : max;
  }, null);

  const now = Date.now();
  const baseTime = lastScheduled ? lastScheduled + minIntervalMs : now;
  const scheduledAt = new Date(Math.max(now, baseTime) + randomJitter(jitterMs));

  await queueRepository.insertMany([
    {
      owner_id: ownerId,
      lead_id: leadId,
      channel: "whatsapp",
      message_id: message.id,
      scheduled_at: scheduledAt.toISOString(),
      status: "waiting",
    },
  ]);

  await planRepository.unassign(leadId);
  await botLogs.create(`${lead.name} adicionado manualmente à fila de hoje.`, "info");
  return { ok: true };
}
