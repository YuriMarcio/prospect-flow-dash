import "dotenv/config";

import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 8_000;

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function getGemini(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Configure GEMINI_API_KEY no .env para usar a IA de respostas.");
  }
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

/**
 * Chamada com saída estruturada (JSON validado pelo responseSchema) e timeout
 * curto — quem chama decide o fallback quando a IA não responde a tempo.
 */
export async function generateStructured<T>(input: {
  prompt: string;
  responseSchema: Record<string, unknown>;
  model?: string;
  timeoutMs?: number;
}): Promise<T> {
  const ai = getGemini();
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Gemini não respondeu em ${timeoutMs}ms.`)), timeoutMs);
  });

  try {
    const response = await Promise.race([
      ai.models.generateContent({
        model: input.model || DEFAULT_MODEL,
        contents: input.prompt,
        config: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: input.responseSchema,
          // Classificação/personalização não precisam de raciocínio longo —
          // desligar o thinking corta latência e custo do 2.5-flash.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      timeout,
    ]);

    const text = response.text;
    if (!text) throw new Error("Gemini retornou resposta vazia.");
    return JSON.parse(text) as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
