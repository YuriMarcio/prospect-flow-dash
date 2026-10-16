import type { GroqChatMessage, GroqJsonSchema } from "../../lib/groq";
import type { PlannerAiResponse, PlannerObjectiveDraft, PlannerTaskDraft, PlannerTurn } from "./objective-planning.types";

const AREAS = ["vendas", "marketing", "administrativo", "desenvolvimento"];
const PRIORITIES = ["critica", "alta", "media", "baixa"];

/**
 * Item do plano com `levelsBelow` níveis de sub-itens aninhados. O schema é desenrolado em vez de
 * recursivo ($ref) porque o modo strict da Groq não garante recursão — e a hierarquia do board é fixa:
 * objetivo → marco → issue → subissue.
 */
function nodeSchema(levelsBelow: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    ...extra,
    title: { type: "string" },
    description: { type: "string" },
    dueDate: { type: ["string", "null"], description: "Data ISO yyyy-mm-dd, ou null se não foi dito." },
    owner: { type: ["string", "null"], description: "Nome do responsável, como foi falado." },
    area: {
      type: ["string", "null"],
      description: `Uma de: ${AREAS.join(", ")}. null se o texto não indicar com clareza (os sub-itens herdam a área do pai).`,
    },
    priority: {
      type: ["string", "null"],
      description: `Uma de: ${PRIORITIES.join(", ")}. null se o texto não trouxer prioridade.`,
    },
    done: { type: "boolean", description: "true só se o texto diz que o item já está feito/concluído." },
  };
  if (levelsBelow > 0) {
    properties.tasks = {
      type: "array",
      items: nodeSchema(levelsBelow - 1),
      description: "Itens aninhados DENTRO desse. Pode ficar vazio.",
    };
  }
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

const OBJECTIVE_SCHEMA = nodeSchema(3, {
  kind: {
    type: "string",
    enum: ["objective", "task"],
    description:
      "'task' quando o usuário só quer um item avulso e simples (sem virar uma meta maior); 'objective' quando é algo mais amplo, com ou sem sub-tarefas.",
  },
});

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
    "Você ajuda o usuário a planejar objetivos e tarefas de trabalho conversando por voz ou texto.",
    "Cada item da lista `objectives` pode ser um 'objective' (uma meta maior) ou um 'task' (algo pontual, simples). Os dois aparecem como card no board igualmente — a diferença é só o rótulo.",
    "IMPORTANTE: uma 'task' NUNCA precisa estar dentro de um 'objective'. Se o usuário pedir só uma tarefa avulsa ('cria uma tarefa pra mim', 'só isso, sem objetivo'), crie um item com kind='task' DIRETO na lista `objectives` (não dentro do campo `tasks` de outro item) e NUNCA pergunte se ele quer criar um objetivo pra ela — isso já foi perguntado e recusado antes se o usuário disser algo como 'não precisa', 'sem vincular a nada' ou similar.",
    "Só use o campo `tasks` aninhado quando o próprio usuário descrever algo como um passo de um objetivo maior específico (ex: 'dentro desse objetivo, quebra em duas tarefas: X e Y').",
    `Hoje é ${weekday}, ${todayIso}. Converta datas relativas ("sexta que vem", "daqui 2 semanas", "esse trimestre" = último dia do trimestre civil atual, "esse mês"/"fim do mês" = último dia do mês atual) para o formato ISO yyyy-mm-dd, calculando com cuidado — datas diferentes ("fim do mês" e "esse trimestre") não podem virar a mesma data a menos que realmente coincidam. Se não der pra inferir uma data com confiança, deixe dueDate como null — não invente.`,
    teamNames.length
      ? `Nomes da equipe, pra usar exatamente como estão aqui quando o usuário mencionar um responsável: ${teamNames.join(", ")}.`
      : "",
    "HIERARQUIA: o board tem até 4 níveis — objetivo (o card de topo, em `objectives`) → marco → issue → subissue, cada nível dentro do campo `tasks` do nível de cima. Não existe um 5º nível: se a lista tiver mais níveis, junte o excedente na descrição do item.",
    "IMPORTAR LISTA/DOCUMENTO: quando o usuário colar uma lista, EAP, checklist ou plano já estruturado, traga TUDO, na estrutura original — não resuma, não agrupe, não omita nem junte itens, e não pergunte antes de montar (monte e depois pergunte o que faltar). Mantenha a numeração/código original no começo do título (ex.: '1.1.1 Política comercial aprovada'). Com numeração, o nível vem dela: 'X.0' ou título de seção grande = objetivo; 'X.Y' = marco; 'X.Y.Z' = issue; um nível abaixo disso = subissue. Sem numeração, use os títulos de seção como objetivos/marcos e os itens como issues. Cada item da lista é um item do plano, nunca apenas texto dentro da descrição de outro.",
    `Campos opcionais, preenchidos SÓ com o que o texto diz: area (${AREAS.join(", ")}) — deduza do nome da seção quando for claro (Comercial/vendas → vendas; Marketing → marketing; Desenvolvimento/produto/tecnologia → desenvolvimento; financeiro/jurídico/gestão → administrativo); priority (${PRIORITIES.join(", ")}) — se a lista usar P0/P1/P2, converta P0 → critica, P1 → alta, P2 → media, e guarde o rótulo original na descrição; done=true só para itens marcados como feitos/concluídos. Outros status do texto (ex.: 'em produção', 'em andamento') vão na descrição, não em done.`,
    "Nunca invente responsável nem prazo: se o texto não traz, deixe owner e dueDate como null. A descrição pode ficar vazia ('') quando não há nada além do título.",
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

function asArea(value: unknown): string | null {
  return typeof value === "string" && AREAS.includes(value) ? value : null;
}

function asPriority(value: unknown): string | null {
  return typeof value === "string" && PRIORITIES.includes(value) ? value : null;
}

/** Niveis abaixo do objetivo: marco → issue → subissue. O que passar disso é descartado pelo schema; aqui só protege. */
const MAX_NESTED_LEVELS = 3;

function normalizeTaskDraft(raw: unknown, levelsLeft = MAX_NESTED_LEVELS): PlannerTaskDraft {
  const obj = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {};
  return {
    title: asString(obj.title),
    description: asString(obj.description),
    dueDate: asNullableString(obj.dueDate),
    owner: asNullableString(obj.owner),
    area: asArea(obj.area),
    priority: asPriority(obj.priority),
    done: obj.done === true,
    tasks:
      levelsLeft > 1 && Array.isArray(obj.tasks) ? obj.tasks.map((task) => normalizeTaskDraft(task, levelsLeft - 1)) : [],
  };
}

function normalizeObjectiveDraft(raw: unknown): PlannerObjectiveDraft {
  const obj = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {};
  return {
    ...normalizeTaskDraft(obj, MAX_NESTED_LEVELS + 1),
    kind: obj.kind === "task" ? "task" : "objective",
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
