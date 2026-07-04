import * as queueRepository from "../../modules/prospector/queue.repository";
import * as messagesRepository from "../../modules/prospector/messages.repository";
import * as prospectorRepository from "../../modules/prospector/prospector.repository";
import * as campaignsRepository from "../../modules/prospecting-campaigns/prospecting-campaigns.repository";
import * as botLogs from "../../modules/prospector/botlogs.repository";
import * as leadsRepository from "../../modules/leads/leads.repository";
import { getEvolutionClient } from "../../lib/evolution";
import { classifyResponse } from "./classifier";
import { sendMessageBlocks } from "./send-blocks";

interface InboundMessage {
  instanceName: string | null;
  fromMe: boolean;
  phone: string;
  text: string;
  receivedAt: number;
}

/**
 * Parsing defensivo do payload da Evolution API (evento MESSAGES_UPSERT).
 * O formato exato é confirmado no primeiro teste real — por isso logamos
 * o payload bruto quando algum campo esperado não é encontrado.
 */
function parseInboundMessage(payload: Record<string, unknown>): InboundMessage | null {
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const key = (data.key ?? {}) as Record<string, unknown>;
  const message = (data.message ?? {}) as Record<string, unknown>;

  const instanceName = typeof payload.instance === "string" ? payload.instance : null;
  const fromMe = Boolean(key.fromMe);
  const remoteJid = typeof key.remoteJid === "string" ? key.remoteJid : "";
  const phone = remoteJid.split("@")[0] ?? "";
  const text =
    (typeof message.conversation === "string" && message.conversation) ||
    (typeof (message.extendedTextMessage as Record<string, unknown>)?.text === "string" &&
      (message.extendedTextMessage as Record<string, unknown>).text) ||
    "";

  if (!phone || typeof text !== "string" || !text) return null;

  const messageTimestamp = data.messageTimestamp;
  const receivedAt =
    typeof messageTimestamp === "number" ? messageTimestamp * 1000 : Date.now();

  return { instanceName, fromMe, phone, text, receivedAt };
}

export async function handleWhatsappWebhook(payload: Record<string, unknown>): Promise<void> {
  const inbound = parseInboundMessage(payload);

  if (!inbound) {
    await botLogs.create(`Webhook recebido em formato não reconhecido: ${JSON.stringify(payload).slice(0, 500)}`, "warn");
    return;
  }

  if (inbound.fromMe) return;

  if (!inbound.instanceName) {
    await botLogs.create(`Webhook sem identificação de instância. Ignorado: ${JSON.stringify(payload).slice(0, 500)}`, "warn");
    return;
  }

  const instance = await prospectorRepository.findInstanceByName(inbound.instanceName);
  if (!instance) {
    await botLogs.create(`Webhook de instância desconhecida "${inbound.instanceName}". Ignorado.`, "warn");
    return;
  }

  const lead = await leadsRepository.findByWhatsapp(inbound.phone);
  if (!lead) return;

  const campaignId: string | null = lead.prospecting_campaign_id ?? null;

  const lastSent = await queueRepository.findMostRecentSentForLead(lead.id);
  if (!lastSent || !lastSent.sent_at) return;

  const elapsedMs = inbound.receivedAt - new Date(lastSent.sent_at).getTime();
  const recentTexts = await queueRepository.findRecentResponseTexts(
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  );
  const isDuplicate = recentTexts.includes(inbound.text.trim());

  const classification = classifyResponse({ elapsedMs, text: inbound.text, isDuplicate });

  await queueRepository.update(lastSent.id, {
    response_text: inbound.text,
    response_at: new Date(inbound.receivedAt).toISOString(),
    response_classification: classification,
    status: classification === "bot" ? "sent" : "replied",
  });

  if (classification === "bot") {
    await botLogs.create(`Resposta de ${lead.name} classificada como BOT. Lead mantido em prospecção.`, "info", campaignId ?? undefined);
    return;
  }

  await leadsRepository.update(lead.id, { status: "negociacao", column_id: "col-3" });
  await botLogs.create(
    `Resposta de ${lead.name} classificada como ${classification.toUpperCase()}. Lead movido para Negociação.`,
    "info",
    campaignId ?? undefined,
  );

  await sendChainedReplyIfConfigured(lead, lastSent, inbound.phone, campaignId);
}

async function sendChainedReplyIfConfigured(
  lead: { id: string; name: string; whatsapp: string | null },
  lastSent: { message_id: string | null },
  digitsOnly: string,
  campaignId: string | null,
): Promise<void> {
  if (!lastSent.message_id || !campaignId) return;

  const originalMessage = await messagesRepository.findById(lastSent.message_id);
  if (!originalMessage?.reply_message_id) return;

  const replyMessage = await messagesRepository.findById(originalMessage.reply_message_id);
  if (!replyMessage) return;

  const campaign = await campaignsRepository.findById(campaignId);
  if (!campaign) return;

  const instance = await prospectorRepository.findInstanceByChannel("whatsapp", campaign.owner_user_id);
  if (!instance || instance.status !== "connected") return;

  const client = getEvolutionClient();
  await sendMessageBlocks(client, instance.instance_name, digitsOnly, replyMessage.bot_message_blocks);

  await queueRepository.insertMany([
    {
      prospecting_campaign_id: campaignId,
      lead_id: lead.id,
      channel: "whatsapp",
      message_id: replyMessage.id,
      scheduled_at: new Date().toISOString(),
      status: "sent",
      sent_at: new Date().toISOString(),
    },
  ]);

  await botLogs.create(`Resposta automática "${replyMessage.title}" enviada para ${lead.name}.`, "info", campaignId);
}
