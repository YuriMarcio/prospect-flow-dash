import type { GroqChatMessage, GroqJsonSchema } from "../../lib/groq";
import type { PlannerAiResponse, PlannerObjectiveDraft, PlannerTaskDraft, PlannerTurn } from "./objective-planning.types";

const TASK_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    dueDate: { type: ["string", "null"], description: "Data ISO yyyy-mm-dd, ou null se não foi dito." },
    owner: { type: ["string", "null"], description: "Nome do responsável, como foi falado." },
  },
  required: ["title", "description", "dueDate", "owner"],
  additionalProperties: false,
};

const OBJECTIVE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    dueDate: { type: ["string", "null"], description: "Data ISO yyyy-mm-dd, ou null se não foi dito." },
    owner: { type: ["string", "null"], description: "Nome do responsável, como foi falado." },
    tasks: { type: "array", items: TASK_SCHEMA },
  },
  required: ["title", "description", "dueDate", "owner", "tasks"],
  additionalProperties: false,
};

/** Schema forçado (Groq structured_outputs) — mesma garantia que o responseSchema do Gemini dava. */
export const PLANNER_JSON_SCHEMA: GroqJsonSchema = {
  name: "planner_response",
  schema: {
    type: "object",
    properties: {
      assistantMessage: {
        type: "string",
        description: "O que responder/perguntar de volta pro usuário nesse turno, em português, breve e natural.",
      },
      readyToConfirm: {
        type: "boolean",
        description: "true só quando o plano de objetivos/tarefas já está completo o suficiente pra confirmar.",
      },
      objectives: {
        type: "array",
        items: OBJECTIVE_SCHEMA,
        description: "Estado ATUAL e COMPLETO do plano — não só o que mudou nesse turno, a lista inteira.",
      },
    },
    required: ["assistantMessage", "readyToConfirm", "objectives"],
    additionalProperties: false,
  },
};

export function buildPlannerSystemInstruction(teamNames: string[]): string {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(today);

  return [
    "Você ajuda o usuário a planejar objetivos de trabalho (também chamados de metas ou milestones) conversando por voz ou texto.",
    "Cada objetivo pode ter tarefas — passos menores pra chegar lá, cada uma com seus próprios título, descrição, prazo e responsável.",
    `Hoje é ${weekday}, ${todayIso}. Converta datas relativas ("sexta que vem", "daqui 2 semanas", "esse trimestre" = último dia do trimestre civil atual, "esse mês"/"fim do mês" = último dia do mês atual) para o formato ISO yyyy-mm-dd, calculando com cuidado — datas diferentes ("fim do mês" e "esse trimestre") não podem virar a mesma data a menos que realmente coincidam. Se não der pra inferir uma data com confiança, deixe dueDate como null — não invente.`,
    teamNames.length
      ? `Nomes da equipe, pra usar exatamente como estão aqui quando o usuário mencionar um responsável: ${teamNames.join(", ")}.`
      : "",
    "Não crie objetivos ou tarefas que o usuário não pediu. Se faltar informação importante (ex: não ficou claro quantos objetivos, ou o quê exatamente), pergunte antes de inventar.",
    "IMPORTANTE: sempre que o usuário pedir uma mudança clara (adicionar/remover um objetivo ou tarefa, definir prazo, responsável, etc.), aplique essa mudança IMEDIATAMENTE no array `objectives` da sua resposta neste mesmo turno — nunca prometa aplicar depois nem deixe de aplicar só porque ainda faltam outros detalhes. Você pode aplicar a mudança pedida E, na mesma resposta, perguntar sobre o que ainda falta.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Monta o histórico no formato de mensagens da API da Groq (compatível com
 * OpenAI). O áudio já chega transcrito em texto nesse ponto — a transcrição
 * (Whisper) é um passo separado, feito antes de chamar isso (ver
 * objective-planning.service.ts). O estado atual do plano entra embutido na
 * mensagem do usuário, não no histórico, pra manter os turnos limpos pra
 * exibir num chat de verdade.
 */
export function buildPlannerMessages(
  turns: PlannerTurn[],
  currentDraft: PlannerObjectiveDraft[],
  teamNames: string[],
  userText: string,
): GroqChatMessage[] {
  const history: GroqChatMessage[] = turns.map((turn) => ({ role: turn.role, content: turn.text }));

  const draftNote = currentDraft.length
    ? `[Estado atual do plano, pra referência: ${JSON.stringify(currentDraft)}]\n\n`
    : "";

  return [
    { role: "system", content: buildPlannerSystemInstruction(teamNames) },
    ...history,
    { role: "user", content: `${draftNote}${userText}` },
  ];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeTaskDraft(raw: unknown): PlannerTaskDraft {
  const obj = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {};
  return {
    title: asString(obj.title),
    description: asString(obj.description),
    dueDate: asNullableString(obj.dueDate),
    owner: asNullableString(obj.owner),
  };
}

function normalizeObjectiveDraft(raw: unknown): PlannerObjectiveDraft {
  const obj = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {};
  return {
    title: asString(obj.title),
    description: asString(obj.description),
    dueDate: asNullableString(obj.dueDate),
    owner: asNullableString(obj.owner),
    tasks: Array.isArray(obj.tasks) ? obj.tasks.map(normalizeTaskDraft) : [],
  };
}

/**
 * Groq (modo json_object) só garante JSON sintaticamente válido, não a
 * forma do objeto — diferente do responseSchema do Gemini. Essa validação
 * defensiva normaliza qualquer resposta pro shape esperado em vez de deixar
 * um campo ausente/tipo errado quebrar o resto do fluxo.
 */
export function parsePlannerResponse(raw: unknown): PlannerAiResponse {
  const obj = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {};
  return {
    assistantMessage: asString(obj.assistantMessage) || "Entendi.",
    readyToConfirm: Boolean(obj.readyToConfirm),
    objectives: Array.isArray(obj.objectives) ? obj.objectives.map(normalizeObjectiveDraft) : [],
  };
}
