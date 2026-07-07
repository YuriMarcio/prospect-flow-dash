import { Type } from "@google/genai";
import { generateStructured, isGeminiConfigured } from "../../lib/gemini";
import * as botLogs from "../../modules/prospector/botlogs.repository";
import { buildClassificationPrompt, INTENTS, type Intent } from "./prompts";

export interface AiClassification {
  intencao: Intent;
  sentimento: "positivo" | "neutro" | "negativo";
  prontidao_para_reuniao: "alta" | "media" | "baixa";
  resposta_automatica: boolean;
  resumo: string;
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intencao: { type: Type.STRING, enum: [...INTENTS] },
    sentimento: { type: Type.STRING, enum: ["positivo", "neutro", "negativo"] },
    prontidao_para_reuniao: { type: Type.STRING, enum: ["alta", "media", "baixa"] },
    resposta_automatica: { type: Type.BOOLEAN },
    resumo: { type: Type.STRING },
  },
  required: ["intencao", "sentimento", "prontidao_para_reuniao", "resposta_automatica", "resumo"],
};

function formatElapsed(elapsedMs: number): string {
  if (elapsedMs < 60_000) return `${Math.max(1, Math.round(elapsedMs / 1000))} segundos`;
  if (elapsedMs < 3_600_000) return `${Math.round(elapsedMs / 60_000)} minutos`;
  return `${Math.round(elapsedMs / 3_600_000)} horas`;
}

/**
 * Classifica a resposta do lead com o Gemini. Retorna null em qualquer falha
 * (sem chave, timeout, erro) — o caller cai no classificador regex.
 */
export async function classifyReplyWithAI(
  input: {
    leadName: string;
    leadSegment: string | null;
    lastSentText: string;
    replyText: string;
    elapsedMs: number;
  },
  options?: { model?: string; campaignId?: string },
): Promise<AiClassification | null> {
  if (!isGeminiConfigured()) return null;

  try {
    return await generateStructured<AiClassification>({
      model: options?.model,
      prompt: buildClassificationPrompt({
        leadName: input.leadName,
        leadSegment: input.leadSegment,
        lastSentText: input.lastSentText,
        replyText: input.replyText,
        elapsedHuman: formatElapsed(input.elapsedMs),
      }),
      responseSchema: RESPONSE_SCHEMA,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await botLogs.create(
      `IA indisponível para classificar resposta (${message}). Usando classificador padrão.`,
      "warn",
      options?.campaignId,
    );
    return null;
  }
}
