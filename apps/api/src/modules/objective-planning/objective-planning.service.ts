import { generateJson, isGroqConfigured, transcribeAudio } from "../../lib/groq";
import { listUsers, type AuthUser } from "../auth/auth.service";
import { createObjectiveService } from "../objectives/objectives.service";
import * as planningRepository from "./objective-planning.repository";
import { buildPlannerMessages, parsePlannerResponse, PLANNER_JSON_SCHEMA } from "./objective-planning.prompts";
import type { PlannerObjectiveDraft, PlannerTurn, PlanningSessionRow } from "./objective-planning.types";

// Turno de voz passa por dois passos (Whisper transcreve, Llama estrutura) —
// timeout bem maior que o default de 8s do helper de classificação rápida.
const PLANNER_TIMEOUT_MS = 30_000;

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

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Casa o nome falado pela IA contra a equipe cadastrada — sem match exato, mantém só o texto livre. */
function resolveOwner(ownerName: string | null, users: AuthUser[]): { owner: string | null; assignedUserId: string | null } {
  if (!ownerName?.trim()) return { owner: null, assignedUserId: null };
  const target = normalize(ownerName);
  const match = users.find(
    (u) => (u.name && normalize(u.name) === target) || (u.username && normalize(u.username) === target),
  );
  return match ? { owner: match.name ?? match.username, assignedUserId: match.id } : { owner: ownerName, assignedUserId: null };
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

  const raw = await generateJson<unknown>({ messages, responseSchema: PLANNER_JSON_SCHEMA, timeoutMs: PLANNER_TIMEOUT_MS });
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
  const createdIds: string[] = [];

  for (const objectiveDraft of session.draft) {
    const { owner, assignedUserId } = resolveOwner(objectiveDraft.owner, users);
    const objective = await createObjectiveService({
      columnId,
      title: objectiveDraft.title,
      description: objectiveDraft.description,
      dueDate: objectiveDraft.dueDate,
      owner,
      assignedUserId,
      kind: "objective",
    });
    createdIds.push(objective.id);

    for (const taskDraft of objectiveDraft.tasks) {
      const taskOwner = resolveOwner(taskDraft.owner, users);
      const task = await createObjectiveService({
        title: taskDraft.title,
        description: taskDraft.description,
        dueDate: taskDraft.dueDate,
        owner: taskOwner.owner,
        assignedUserId: taskOwner.assignedUserId,
        kind: "task",
        parentObjectiveId: objective.id,
      });
      createdIds.push(task.id);
    }
  }

  const updated = await planningRepository.setStatus(session.id, "confirmed", createdIds);
  return { session: updated, createdObjectiveIds: createdIds };
}

export async function cancelSession(session: PlanningSessionRow): Promise<PlanningSessionRow> {
  return planningRepository.setStatus(session.id, "cancelled");
}

export type { PlannerObjectiveDraft };
