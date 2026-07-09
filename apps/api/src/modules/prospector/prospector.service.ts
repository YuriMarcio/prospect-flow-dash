import { EvolutionApiError } from "@sinal/evolution-client";
import { getEvolutionClient } from "../../lib/evolution";
import * as prospectorRepository from "./prospector.repository";
import * as messagesRepository from "./messages.repository";
import * as mediaRepository from "./media.repository";
import * as queueRepository from "./queue.repository";
import * as planRepository from "./plan.repository";
import * as botLogs from "./botlogs.repository";
import * as leadsRepository from "../leads/leads.repository";
import { isWarmingDone } from "../../workers/prospector/warming";
import { buildTodayQueue, enqueueLeadNow, toDateKey } from "../../workers/prospector/queue-builder.worker";
import { handleWhatsappWebhook } from "../../workers/prospector/webhook-handler";
import * as campaignsRepository from "../prospecting-campaigns/prospecting-campaigns.repository";

const SUPPORTED_CHANNELS = ["whatsapp"];

export async function connectInstanceService(
  channel: string,
  ownerId: string,
  instanceName: string,
  numberAge: "new" | "established",
) {
  if (!SUPPORTED_CHANNELS.includes(channel)) {
    throw new Error(`Canal "${channel}" ainda não suportado.`);
  }

  const client = getEvolutionClient();
  const publicUrl = process.env.API_PUBLIC_URL ?? "http://localhost:3333";

  try {
    await client.createInstance({ instanceName });
  } catch (error) {
    const alreadyExists =
      error instanceof EvolutionApiError &&
      error.statusCode === 403 &&
      JSON.stringify(error.responseBody).includes("already in use");
    if (!alreadyExists) throw error;
  }

  await client.setWebhook(instanceName, {
    enabled: true,
    url: `${publicUrl}/prospector/webhook/${channel}`,
    events: ["MESSAGES_UPSERT"],
  });

  const qr = await client.getQrCode(instanceName);
  // O formato exato (imagem já renderizada em base64 vs. código de pareamento cru)
  // varia por versão da Evolution API — repassamos o que vier e deixamos o
  // frontend decidir como renderizar.
  const qrValue =
    (qr as Record<string, unknown>).base64 ??
    (qr as Record<string, unknown>).code ??
    null;

  const instance = await prospectorRepository.upsertInstance(channel, ownerId, instanceName, {
    status: "connecting",
    qr_code: typeof qrValue === "string" ? qrValue : null,
    number_age: numberAge,
    warming_done: numberAge === "established",
  });

  await botLogs.create(`Instância "${instanceName}" (${channel}) iniciando conexão (${numberAge}).`);
  return { qrcode: typeof qrValue === "string" ? qrValue : null, instance };
}

/** Status da conexão de WhatsApp do usuário logado — independe de campanha. */
export async function getInstanceStatusService(ownerId: string) {
  const instance = await prospectorRepository.findInstanceByChannel("whatsapp", ownerId);
  let connected = instance?.status === "connected";

  if (instance && instance.status !== "connected") {
    try {
      const client = getEvolutionClient();
      const liveStatus = await client.getInstanceStatus(instance.instance_name);
      connected = liveStatus?.instance?.state === "open";

      if (connected) {
        await prospectorRepository.updateInstance(instance.instance_name, {
          status: "connected",
          connected_at: instance.connected_at ?? new Date().toISOString(),
          qr_code: null,
        });
      }
    } catch {
      // Sem credenciais configuradas ou Evolution fora do ar — mantém status atual
    }
  }

  return {
    connected,
    instanceName: instance?.instance_name ?? null,
    warmingDone: instance ? isWarmingDone(instance) : true,
  };
}

export async function listMessagesService(campaignId: string) {
  return messagesRepository.findAll(campaignId);
}

export async function createMessageService(campaignId: string, data: Record<string, unknown>) {
  return messagesRepository.create(campaignId, data);
}

export async function updateMessageService(id: string, patch: Record<string, unknown>) {
  return messagesRepository.update(id, patch);
}

export async function deleteMessageService(id: string) {
  return messagesRepository.remove(id);
}

export async function uploadMediaService(input: { fileName: string; mimeType: string; dataBase64: string }) {
  const url = await mediaRepository.uploadMedia(input.fileName, input.mimeType, input.dataBase64);
  return { url };
}

export async function buildQueueService(campaignId: string) {
  const campaign = await campaignsRepository.findById(campaignId);
  if (!campaign) throw new Error("Campanha não encontrada.");
  return buildTodayQueue(campaign);
}

export async function listQueueService(campaignId: string) {
  return queueRepository.findAllForToday(campaignId);
}

export async function listLogsService(campaignId?: string) {
  return campaignId ? botLogs.findRecentByCampaign(campaignId, 100) : botLogs.findRecent(100);
}

export async function handleWebhookService(channel: string, payload: Record<string, unknown>) {
  if (channel === "whatsapp") {
    // O processamento pode chamar IA (alguns segundos) — solta a resposta da
    // Evolution imediatamente e processa em background.
    setImmediate(() => {
      handleWhatsappWebhook(payload).catch((err) => {
        console.error("[PROSPECTOR] Erro ao processar webhook:", err);
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Plano semanal (arrastar lead pra um dia no "Kanban do bot" de uma campanha)
// ---------------------------------------------------------------------------

export async function listPlanService(campaignId: string) {
  return planRepository.findAll(campaignId);
}

export async function assignLeadToDayService(leadId: string, date: string, campaignId: string) {
  const todayKey = toDateKey(new Date());

  if (date === todayKey) {
    return enqueueLeadNow(leadId, campaignId);
  }

  const existingCampaignId = await leadsRepository.findCampaignIdForLead(leadId);
  if (existingCampaignId && existingCampaignId !== campaignId) {
    const other = await campaignsRepository.findById(existingCampaignId);
    return { ok: false, reason: `Este lead já está na campanha "${other?.name ?? "outra"}".` };
  }

  const lead = await leadsRepository.findById(leadId);
  if (!lead?.whatsapp) return { ok: false, reason: "Lead sem WhatsApp cadastrado." };
  if (lead.status !== "novo") {
    return { ok: false, reason: 'Só leads em "A Prospectar" podem entrar na fila do bot.' };
  }

  await planRepository.assign(leadId, date, campaignId);
  return { ok: true };
}

export async function unassignLeadService(leadId: string) {
  await planRepository.unassign(leadId);
}
