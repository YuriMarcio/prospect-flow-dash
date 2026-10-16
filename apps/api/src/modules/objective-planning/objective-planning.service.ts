import { generateJson, isGroqConfigured, transcribeAudio } from "../../lib/groq";
import { listUsers } from "../auth/auth.service";
import { createObjectiveTreesService } from "../objectives/objectives.service";
import * as planningRepository from "./objective-planning.repository";
import { buildPlannerMessages, parsePlannerResponse, PLANNER_JSON_SCHEMA } from "./objective-planning.prompts";
import { toTreeNode } from "./objective-planning.tree";
import type { PlannerObjectiveDraft, PlannerTurn, PlanningSessionRow } from "./objective-planning.types";

// Turno de voz passa por dois passos (Whisper transcreve, Llama estrutura) —
// timeout bem maior que o default de 8s do helper de classificação rápida.
// Colar uma lista grande (dezenas de itens) faz o modelo devolver o plano inteiro, o que leva mais tempo.
const PLANNER_TIMEOUT_MS = 90_000;
/** Teto de saída: o plano completo de uma lista grande passa fácil do padrão do modelo. */
const PLANNER_MAX_OUTPUT_TOKENS = 32_000;

export async function getOrCreateActiveSession(
  ownerUserId: string,
  channel: "web" | "whatsapp",
): Promise<PlanningSessionRow> {
  const existing = await planningRepository.findActive(ownerUserId, channel);
  if (existing) return existing;
  return planningRepository.create(ownerUserId, channel);
}

export async function getSessionOrThrow(id: string): Promise<PlanningSessionRow> {
  const session = await planningRepository.findById(id);
  if (!session) throw new Error("Sessão de planejamento não encontrada.");
  return session;
}

export async function appendTurn(
  session: PlanningSessionRow,
  input: { text?: string; audioBase64?: string; audioMimeType?: string },
): Promise<PlanningSessionRow> {
  if (session.status !== "active") throw new Error("Essa sessão de planejamento já foi encerrada.");
  if (!isGroqConfigured()) throw new Error("Configure GROQ_API_KEY no .env para usar o planejador por IA.");
  if (!input.text?.trim() && !input.audioBase64) throw new Error("Fale ou digite alguma coisa.");

  // Áudio primeiro vira texto (Whisper) — só depois entra na chamada que
  // estrutura o plano. Dois passos, dois modelos, mas cada um mais barato
  // e melhor no que faz do que um multimodal genérico faria.
  const userText = input.audioBase64
    ? await transcribeAudio({
        buffer: Buffer.from(input.audioBase64, "base64"),
        filename: "audio",
        mimeType: input.audioMimeType ?? "audio/webm",
        timeoutMs: PLANNER_TIMEOUT_MS,
      })
    : input.text!.trim();

  const teamNames = (await listUsers()).map((u) => u.name || u.username).filter((n): n is string => Boolean(n));
  const messages = buildPlannerMessages(session.turns, session.draft, teamNames, userText);

  const raw = await generateJson<unknown>({
    messages,
    responseSchema: PLANNER_JSON_SCHEMA,
    timeoutMs: PLANNER_TIMEOUT_MS,
    maxOutputTokens: PLANNER_MAX_OUTPUT_TOKENS,
  });
  const response = parsePlannerResponse(raw);

  const now = new Date().toISOString();
  const nextTurns: PlannerTurn[] = [
    ...session.turns,
    { role: "user", text: userText, createdAt: now },
    { role: "assistant", text: response.assistantMessage, createdAt: now },
  ];

  return planningRepository.appendTurnResult(session.id, {
    turns: nextTurns,
    draft: response.objectives,
    lastAssistantMessage: response.assistantMessage,
    readyToConfirm: response.readyToConfirm,
  });
}

export async function confirmSession(
  session: PlanningSessionRow,
  columnId: string,
): Promise<{ session: PlanningSessionRow; createdObjectiveIds: string[] }> {
  if (session.status !== "active") throw new Error("Essa sessão de planejamento já foi encerrada.");
  if (!session.draft.length) throw new Error("Não há nenhum objetivo pra criar ainda.");

  const users = await listUsers();
  const createdIds = await createObjectiveTreesService(
    session.draft.map((draft) => toTreeNode(draft, users)),
    columnId,
  );

  const updated = await planningRepository.setStatus(session.id, "confirmed", createdIds);
  return { session: updated, createdObjectiveIds: createdIds };
}

export async function cancelSession(session: PlanningSessionRow): Promise<PlanningSessionRow> {
  return planningRepository.setStatus(session.id, "cancelled");
}

export type { PlannerObjectiveDraft };
