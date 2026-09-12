import "dotenv/config";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
// Modelos da Groq mudam de catálogo com frequência (deprecations, renomeações) —
// confirme em GET /openai/v1/models se a chamada começar a devolver 404
// "model_not_found". gpt-oss-120b é o que tem `structured_outputs` disponível
// no catálogo atual, o que dá schema JSON forçado (não só "json válido").
const DEFAULT_CHAT_MODEL = "openai/gpt-oss-120b";
const DEFAULT_WHISPER_MODEL = "whisper-large-v3-turbo";
const DEFAULT_TIMEOUT_MS = 30_000;

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

function apiKey(): string {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Configure GROQ_API_KEY no .env para usar o planejador por IA.");
  }
  return process.env.GROQ_API_KEY;
}

export interface GroqChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqJsonSchema {
  name: string;
  schema: Record<string, unknown>;
}

/**
 * Chat com saída em JSON via Groq (API compatível com a da OpenAI). Com
 * `responseSchema`, usa `json_schema` (strict) — mesma garantia de shape que
 * o responseSchema do Gemini dava, só disponível nos modelos com
 * `structured_outputs` no catálogo da Groq. Sem `responseSchema`, cai pro
 * modo `json_object`, que só garante JSON sintaticamente válido — quem
 * chamar sem schema precisa validar o shape depois de parsear.
 */
export async function generateJson<T>(input: {
  messages: GroqChatMessage[];
  responseSchema?: GroqJsonSchema;
  model?: string;
  timeoutMs?: number;
}): Promise<T> {
  const responseFormat = input.responseSchema
    ? { type: "json_schema", json_schema: { name: input.responseSchema.name, schema: input.responseSchema.schema, strict: true } }
    : { type: "json_object" };

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model || DEFAULT_CHAT_MODEL,
      messages: input.messages,
      temperature: 0,
      response_format: responseFormat,
    }),
    signal: AbortSignal.timeout(input.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Groq respondeu ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq retornou resposta vazia.");
  return JSON.parse(text) as T;
}

/** Transcreve áudio (Whisper via Groq) e devolve só o texto. */
export async function transcribeAudio(input: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  model?: string;
  timeoutMs?: number;
}): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }), input.filename);
  form.append("model", input.model || DEFAULT_WHISPER_MODEL);
  form.append("language", "pt");
  form.append("response_format", "text");

  const response = await fetch(`${GROQ_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
    signal: AbortSignal.timeout(input.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Groq (transcrição) respondeu ${response.status}: ${body.slice(0, 300)}`);
  }

  const text = (await response.text()).trim();
  if (!text) throw new Error("Groq não conseguiu transcrever o áudio.");
  return text;
}
