import { Type } from "@google/genai";
import { generateStructured, isGeminiConfigured } from "../../lib/gemini";
import * as intentResponsesRepository from "../../modules/flows/intent-responses.repository";
import * as queueRepository from "../../modules/prospector/queue.repository";
import * as botLogs from "../../modules/prospector/botlogs.repository";
import type { BotMessageBlockRow } from "../../modules/prospector/messages.repository";
import type { ProspectingCampaignRow } from "../../modules/prospecting-campaigns/prospecting-campaigns.repository";
import { getEvolutionClient } from "../../lib/evolution";
import { sendMessageBlocks } from "./send-blocks";
import { buildPersonalizationPrompt, INTENT_LABELS, type Intent } from "./prompts";

const FALLBACK_INTENT: Intent = "pedindo_mais_info";

const PERSONALIZATION_SCHEMA = {
  type: Type.OBJECT,
  properties: { texto: { type: Type.STRING } },
  required: ["texto"],
};

/**
 * Personaliza levemente só o primeiro bloco de texto (saudação com nome + 1
 * referência ao que o lead disse). Imagem e áudio pré-gravado passam intactos.
 * Qualquer falha → envia o texto-base sem personalizar; nunca bloqueia.
 */
async function personalizeBlocks(
  blocks: BotMessageBlockRow[],
  input: { leadName: string; replyText: string; model?: string; campaignId: string },
): Promise<BotMessageBlockRow[]> {
  if (!isGeminiConfigured()) return blocks;

  const firstTextIndex = blocks.findIndex((block) => block.type === "text" && block.content.trim());
  if (firstTextIndex === -1) return blocks;

  try {
    const result = await generateStructured<{ texto: string }>({
      model: input.model,
      prompt: buildPersonalizationPrompt({
        leadName: input.leadName,
        replyText: input.replyText,
        baseText: blocks[firstTextIndex].content,
      }),
      responseSchema: PERSONALIZATION_SCHEMA,
    });
    if (!result.texto?.trim()) return blocks;

    const personalized = [...blocks];
    personalized[firstTextIndex] = { ...personalized[firstTextIndex], content: result.texto.trim() };
    return personalized;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await botLogs.create(
      `Falha ao personalizar resposta (${message}). Enviando texto-base.`,
      "warn",
      input.campaignId,
    );
    return blocks;
  }
}

/**
 * Resposta automática híbrida: escolhe a resposta pré-aprovada da intenção
 * detectada (fallback: "pedindo_mais_info"), personaliza levemente o texto e
 * envia. A IA nunca inventa a resposta.
 */
export async function sendIntentReply(input: {
  campaign: ProspectingCampaignRow;
  instanceName: string;
  lead: { id: string; name: string };
  phone: string;
  intent: Intent;
  replyText: string;
}): Promise<void> {
  let response = await intentResponsesRepository.findEnabledByIntent(input.campaign.id, input.intent);
  if (!response && input.intent !== FALLBACK_INTENT) {
    response = await intentResponsesRepository.findEnabledByIntent(input.campaign.id, FALLBACK_INTENT);
  }
  if (!response?.bot_messages) {
    await botLogs.create(
      `Sem resposta cadastrada para a intenção "${INTENT_LABELS[input.intent] ?? input.intent}". Nada enviado.`,
      "info",
      input.campaign.id,
    );
    return;
  }

  const baseBlocks = [...(response.bot_messages.bot_message_blocks ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  if (baseBlocks.length === 0) return;

  const model = (input.campaign.ai_config as { model?: string } | null)?.model;
  const blocks = response.personalize
    ? await personalizeBlocks(baseBlocks, {
        leadName: input.lead.name,
        replyText: input.replyText,
        model,
        campaignId: input.campaign.id,
      })
    : baseBlocks;

  const client = getEvolutionClient();
  await sendMessageBlocks(client, input.instanceName, input.phone, blocks);

  await queueRepository.insertOne({
    prospecting_campaign_id: input.campaign.id,
    lead_id: input.lead.id,
    channel: "whatsapp",
    message_id: response.message_id,
    scheduled_at: new Date().toISOString(),
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  await botLogs.create(
    `Resposta automática (${INTENT_LABELS[input.intent] ?? input.intent}) enviada para ${input.lead.name}.`,
    "info",
    input.campaign.id,
  );
}
