import { EvolutionApiError } from "@sinal/evolution-client";
import { getEvolutionClient } from "../../lib/evolution";
import * as prospectorRepository from "./prospector.repository";
import * as messagesRepository from "./messages.repository";
import * as mediaRepository from "./media.repository";
import * as queueRepository from "./queue.repository";
import * as planRepository from "./plan.repository";
import * as botLogs from "./botlogs.repository";
import * as leadsRepository from "../leads/leads.repository";
import {
  getEffectiveDailyLimit,
  isWarmingDone,
} from "../../workers/prospector/warming";
import {
  buildTodayQueue,
  enqueueLeadNow,
  toDateKey,
} from "../../workers/prospector/queue-builder.worker";
import { handleWhatsappWebhook } from "../../workers/prospector/webhook-handler";
import {
  startSessionService,
  stopSessionService,
} from "../../workers/prospector/session.worker";

export { startSessionService, stopSessionService };

const WEEKDAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;
const SUPPORTED_CHANNELS = ["whatsapp"];

export async function connectInstanceService(
  channel: string,
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

  const instance = await prospectorRepository.upsertInstance(
    channel,
    instanceName,
    {
      status: "connecting",
      qr_code: typeof qrValue === "string" ? qrValue : null,
      number_age: numberAge,
      warming_done: numberAge === "established",
    },
  );

  await botLogs.create(
    `Instância "${instanceName}" (${channel}) iniciando conexão (${numberAge}).`,
  );
  return { qrcode: typeof qrValue === "string" ? qrValue : null, instance };
}

export async function getStatusService() {
  const instance = await prospectorRepository.findInstanceByChannel("whatsapp");
  const config = await prospectorRepository.getConfig();

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

  const todayKey = WEEKDAY_KEYS[new Date().getDay()];
  const dayConfig = config.schedule[todayKey];
  const todayLimit =
    instance && dayConfig ? getEffectiveDailyLimit(instance, dayConfig) : 0;
  const todayCount = await queueRepository.countToday("sent");
  const queueSize = await queueRepository.countToday("waiting");
  const activeMessage = await messagesRepository.findActive();

  return {
    connected,
    is_active: config.is_active,
    todayCount,
    todayLimit,
    queueSize,
    activeMessage,
    warmingDone: instance ? isWarmingDone(instance) : true,
    filters: config.filters,
    sessionMode: config.session_mode,
    sessionStartAt: config.session_start_at,
    sessionEndAt: config.session_end_at,
  };
}

export async function getConfigService() {
  return prospectorRepository.getConfig();
}

export async function updateConfigService(patch: Record<string, unknown>) {
  return prospectorRepository.updateConfig(patch);
}

export async function toggleService() {
  const config = await prospectorRepository.getConfig();
  return prospectorRepository.updateConfig({ is_active: !config.is_active });
}

export async function listMessagesService() {
  return messagesRepository.findAll();
}

export async function createMessageService(data: Record<string, unknown>) {
  return messagesRepository.create(data);
}

export async function updateMessageService(
  id: string,
  patch: Record<string, unknown>,
) {
  return messagesRepository.update(id, patch);
}

export async function deleteMessageService(id: string) {
  return messagesRepository.remove(id);
}

export async function uploadMediaService(input: {
  fileName: string;
  mimeType: string;
  dataBase64: string;
}) {
  const url = await mediaRepository.uploadMedia(input.fileName, input.mimeType, input.dataBase64);
  return { url };
}

export async function buildQueueService() {
  return buildTodayQueue();
}

export async function listQueueService() {
  return queueRepository.findAllForToday();
}

export async function listLogsService() {
  return botLogs.findRecent(100);
}

export async function handleWebhookService(
  channel: string,
  payload: Record<string, unknown>,
) {
  if (channel === "whatsapp") {
    await handleWhatsappWebhook(payload);
  }
}

// ---------------------------------------------------------------------------
// Plano semanal (arrastar lead pra um dia no "Kanban do bot")
// ---------------------------------------------------------------------------

export async function listPlanService() {
  return planRepository.findAll();
}

export async function assignLeadToDayService(leadId: string, date: string) {
  const todayKey = toDateKey(new Date());

  if (date === todayKey) {
    return enqueueLeadNow(leadId);
  }

  const lead = await leadsRepository.findById(leadId);
  if (!lead?.whatsapp)
    return { ok: false, reason: "Lead sem WhatsApp cadastrado." };

  await planRepository.assign(leadId, date);
  return { ok: true };
}

export async function unassignLeadService(leadId: string) {
  await planRepository.unassign(leadId);
}
