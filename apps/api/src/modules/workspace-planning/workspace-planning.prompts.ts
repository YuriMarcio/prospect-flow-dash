import type { GroqChatMessage, GroqJsonSchema } from "../../lib/groq";
import type { MatchedChunk } from "../workspace/workspace-rag.repository";
import type { PageDraft, PlannerAiResponse, PlannerTurn } from "./workspace-planning.types";

// Mesmo conjunto de ícones do seletor manual em DocumentEditor.tsx — mantém
// consistência visual entre página criada por IA e criada à mão.
const ICONS = ["🚀", "📄", "📁", "📝", "💡", "📊", "🎯", "🔥", "🧠", "📚", "💬", "🛠️", "✅", "📌", "📈", "🗂️"];

const PAGE_SCHEMA = {
  type: "object",
  properties: {
    icon: { type: "string", enum: ICONS },
    title: { type: "string" },
    description: { type: "string", description: "Um resumo de uma linha do que a página é." },
    markdown: {
      type: "string",
      description:
        "Conteúdo completo da página em Markdown (títulos #/##/###, listas -, listas numeradas, > citação, ```código```, --- divisor). Sem formatação inline (negrito/itálico são ignorados no editor).",
    },
  },
  required: ["icon", "title", "description", "markdown"],
  additionalProperties: false,
};

export const WORKSPACE_PLANNER_JSON_SCHEMA: GroqJsonSchema = {
  name: "workspace_planner_response",
  schema: {
    type: "object",
    properties: {
      assistantMessage: {
        type: "string",
        description: "O que responder/perguntar de volta pro usuário nesse turno, em português, breve e natural.",
      },
      readyToConfirm: {
        type: "boolean",
        description: "true só quando a página já parece completa o suficiente pra revisar e criar.",
      },
      page: {
        ...PAGE_SCHEMA,
        type: ["object", "null"],
        description: "Rascunho ATUAL e COMPLETO da página — null só se ainda não há nada definido.",
      },
    },
    required: ["assistantMessage", "readyToConfirm", "page"],
    additionalProperties: false,
  },
};

export function buildWorkspacePlannerSystemInstruction(): string {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  return [
    "Você ajuda o usuário a montar uma página no Workspace dele (um editor de notas estilo Notion) conversando por voz ou texto.",
    `Hoje é ${todayIso}.`,
    "Escreva o conteúdo da página em Markdown simples: # para título 1, ## título 2, ### título 3, - para lista, 1. para lista numerada, > para citação, ``` para bloco de código, --- para divisor. Não use negrito/itálico com ** ou * — o editor não interpreta formatação inline, só os marcadores de bloco acima.",
    "Escolha o ícone (emoji) que mais combina com o assunto da página.",
    "IMPORTANTE: sempre que o usuário pedir uma mudança clara (adicionar uma seção, mudar o título, reescrever um trecho, etc.), aplique a mudança IMEDIATAMENTE no campo `markdown` da sua resposta neste mesmo turno — nunca prometa aplicar depois.",
    "Se o usuário só disser um assunto vago ('faz uma página sobre marketing'), monte uma estrutura razoável você mesmo (algumas seções fazem sentido pra esse tipo de página) em vez de fazer várias perguntas antes de mostrar algo — é mais fácil o usuário pedir ajuste em cima de um rascunho do que responder um questionário.",
    "Quando a mensagem do usuário vier acompanhada de trechos de outras páginas do Workspace dele (marcados como [Trechos relacionados...]), use esse conteúdo como referência real — cite/reaproveite o que já existe em vez de inventar do zero, e mencione brevemente que já tem algo relacionado se for relevante. Se nada vier ou nada for útil, ignore e siga normalmente.",
  ].join("\n\n");
}

/** Formata os trechos recuperados por RAG pra injetar como contexto na mensagem do usuário. */
export function formatRelevantContext(chunks: MatchedChunk[]): string {
  if (!chunks.length) return "";
  const items = chunks.map((c) => `- (página "${c.page_title}") ${c.content}`).join("\n");
  return `[Trechos relacionados já existentes no Workspace dele, pra referência:\n${items}]\n\n`;
}

/**
 * Histórico + turno novo no formato de mensagens da Groq. Áudio já chega
 * transcrito em texto (ver workspace-planning.service.ts). O rascunho atual
 * entra embutido na mensagem do usuário, não no histórico, pra manter os
 * turnos limpos pra exibir num chat de verdade.
 */
export function buildWorkspacePlannerMessages(
  turns: PlannerTurn[],
  currentDraft: PageDraft | null,
  userText: string,
  relevantChunks: MatchedChunk[] = [],
): GroqChatMessage[] {
  const history: GroqChatMessage[] = turns.map((turn) => ({ role: turn.role, content: turn.text }));

  const draftNote = currentDraft
    ? `[Rascunho atual da página, pra referência: ${JSON.stringify(currentDraft)}]\n\n`
    : "";
  const contextNote = formatRelevantContext(relevantChunks);

  return [
    { role: "system", content: buildWorkspacePlannerSystemInstruction() },
    ...history,
    { role: "user", content: `${contextNote}${draftNote}${userText}` },
  ];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizePageDraft(raw: unknown): PageDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const title = asString(obj.title);
  if (!title.trim()) return null;
  return {
    icon: asString(obj.icon) || "📄",
    title,
    description: asString(obj.description),
    markdown: asString(obj.markdown),
  };
}

/**
 * Groq (json_schema strict) já garante o shape na maior parte dos casos, mas
 * essa validação defensiva evita que um campo ausente/tipo errado quebre o
 * resto do fluxo — mesmo padrão do objective-planning.
 */
export function parseWorkspacePlannerResponse(raw: unknown): PlannerAiResponse {
  const obj = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {};
  return {
    assistantMessage: asString(obj.assistantMessage) || "Entendi.",
    readyToConfirm: Boolean(obj.readyToConfirm),
    page: normalizePageDraft(obj.page),
  };
}
