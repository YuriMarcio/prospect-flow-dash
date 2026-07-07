import * as queueRepository from "../../modules/prospector/queue.repository";
import * as messagesRepository from "../../modules/prospector/messages.repository";
import * as prospectorRepository from "../../modules/prospector/prospector.repository";
import * as campaignsRepository from "../../modules/prospecting-campaigns/prospecting-campaigns.repository";
import * as botLogs from "../../modules/prospector/botlogs.repository";
import * as leadsRepository from "../../modules/leads/leads.repository";
import { classifyResponse } from "./classifier";
import { classifyReplyWithAI, type AiClassification } from "./ai-classifier";
import { sendIntentReply } from "./auto-responder";
import { notifyOwner } from "./owner-notifier";
import { handleReply } from "./flow-engine";
import { INTENT_LABELS, type Intent } from "./prompts";

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

interface CampaignAiConfig {
  enabled?: boolean;
  auto_reply_enabled?: boolean;
  model?: string;
}

/** Primeiro bloco de texto da última mensagem enviada (contexto pra IA). */
async function findLastSentText(messageId: string | null): Promise<string> {
  if (!messageId) return "";
  const message = await messagesRepository.findById(messageId);
  const textBlock = message?.bot_message_blocks.find((block) => block.type === "text");
  return textBlock?.content ?? "";
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
  const campaign = campaignId ? await campaignsRepository.findById(campaignId) : null;

  const lastSent = await queueRepository.findMostRecentSentForLead(lead.id);
  if (!lastSent || !lastSent.sent_at) return;

  const elapsedMs = inbound.receivedAt - new Date(lastSent.sent_at).getTime();
  const recentTexts = await queueRepository.findRecentResponseTexts(
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  );
  const isDuplicate = recentTexts.includes(inbound.text.trim());

  // 1. Classificação: IA (se habilitada na campanha) com fallback pro regex
  const aiConfig = (campaign?.ai_config ?? null) as CampaignAiConfig | null;
  let ai: AiClassification | null = null;

  if (aiConfig?.enabled) {
    ai = await classifyReplyWithAI(
      {
        leadName: lead.name,
        leadSegment: campaign?.segment ?? null,
        lastSentText: await findLastSentText(lastSent.message_id),
        replyText: inbound.text,
        elapsedMs,
      },
      { model: aiConfig.model, campaignId: campaignId ?? undefined },
    );
  }

  const classification = ai
    ? ai.resposta_automatica
      ? "bot"
      : "human"
    : classifyResponse({ elapsedMs, text: inbound.text, isDuplicate });

  await queueRepository.update(lastSent.id, {
    response_text: inbound.text,
    response_at: new Date(inbound.receivedAt).toISOString(),
    response_classification: classification,
    response_intent: ai?.intencao ?? null,
    response_ai: ai ?? null,
    status: classification === "bot" ? "sent" : "replied",
  });

  // 2. Resposta automática detectada: não responde, não avança, não notifica
  if (classification === "bot") {
    await botLogs.create(
      `Resposta de ${lead.name} classificada como automática${ai ? " (IA)" : ""}. Lead mantido em prospecção.`,
      "info",
      campaignId ?? undefined,
    );
    return;
  }

  // 3. Resposta humana: move pro Kanban de negociação
  await leadsRepository.update(lead.id, { status: "negociacao", column_id: "col-3" });
  const intentLabel = ai ? INTENT_LABELS[ai.intencao as Intent] ?? ai.intencao : null;
  await botLogs.create(
    intentLabel
      ? `Resposta de ${lead.name}: intenção "${intentLabel}", prontidão ${ai!.prontidao_para_reuniao}. Lead movido para Negociação.`
      : `Resposta de ${lead.name} classificada como ${classification.toUpperCase()}. Lead movido para Negociação.`,
    "info",
    campaignId ?? undefined,
  );

  if (!campaign || !campaignId) return;

  // 4. Resposta automática híbrida por intenção (se habilitada na campanha)
  if (aiConfig?.auto_reply_enabled && ai) {
    try {
      await sendIntentReply({
        campaign,
        instanceName: instance.instance_name,
        lead: { id: lead.id, name: lead.name },
        phone: inbound.phone,
        intent: ai.intencao,
        replyText: inbound.text,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await botLogs.create(`Falha ao enviar resposta automática: ${message}`, "error", campaignId);
    }
  }

  // 5. Avança o lead no fluxo (ramo "replied"/roteador de intenção)
  try {
    await handleReply({
      leadId: lead.id,
      campaignId,
      instanceName: instance.instance_name,
      phone: inbound.phone,
      intent: ai?.intencao ?? null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await botLogs.create(`Falha ao avançar lead no fluxo: ${message}`, "error", campaignId);
  }

  // 6. Notifica o dono (independente da resposta automática)
  try {
    await notifyOwner({
      campaign,
      instanceName: instance.instance_name,
      lead: { id: lead.id, name: lead.name },
      replyText: inbound.text,
      ai,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await botLogs.create(`Falha ao notificar o dono: ${message}`, "error", campaignId);
  }
}
