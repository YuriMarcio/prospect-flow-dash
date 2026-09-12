import { generateJson, isGroqConfigured, transcribeAudio } from "../../lib/groq";
import { searchRelevantChunks } from "../workspace/workspace-rag.service";
import * as planningRepository from "./workspace-planning.repository";
import {
  buildWorkspacePlannerMessages,
  parseWorkspacePlannerResponse,
  WORKSPACE_PLANNER_JSON_SCHEMA,
} from "./workspace-planning.prompts";
import type { PlannerTurn, WorkspacePlanningSessionRow } from "./workspace-planning.types";

const PLANNER_TIMEOUT_MS = 30_000;

export async function getOrCreateActiveSession(
  ownerUserId: string,
  channel: "web" | "whatsapp",
): Promise<WorkspacePlanningSessionRow> {
  const existing = await planningRepository.findActive(ownerUserId, channel);
  if (existing) return existing;
  return planningRepository.create(ownerUserId, channel);
}

export async function getSessionOrThrow(id: string): Promise<WorkspacePlanningSessionRow> {
  const session = await planningRepository.findById(id);
  if (!session) throw new Error("Sessão de planejamento não encontrada.");
  return session;
}

export async function appendTurn(
  session: WorkspacePlanningSessionRow,
  input: { text?: string; audioBase64?: string; audioMimeType?: string },
): Promise<WorkspacePlanningSessionRow> {
  if (session.status !== "active") throw new Error("Essa sessão de planejamento já foi encerrada.");
  if (!isGroqConfigured()) throw new Error("Configure GROQ_API_KEY no .env para usar o planejador por IA.");
  if (!input.text?.trim() && !input.audioBase64) throw new Error("Fale ou digite alguma coisa.");

  const userText = input.audioBase64
    ? await transcribeAudio({
        buffer: Buffer.from(input.audioBase64, "base64"),
        filename: "audio",
        mimeType: input.audioMimeType ?? "audio/webm",
        timeoutMs: PLANNER_TIMEOUT_MS,
      })
    : input.text!.trim();

  // RAG: busca trechos de outras páginas do Workspace relacionados ao que o
  // usuário acabou de dizer — best-effort, nunca lança (ver workspace-rag.service.ts).
  const relevantChunks = await searchRelevantChunks(userText);
  const messages = buildWorkspacePlannerMessages(session.turns, session.draft, userText, relevantChunks);
  const raw = await generateJson<unknown>({
    messages,
    responseSchema: WORKSPACE_PLANNER_JSON_SCHEMA,
    timeoutMs: PLANNER_TIMEOUT_MS,
  });
  const response = parseWorkspacePlannerResponse(raw);

  const now = new Date().toISOString();
  const nextTurns: PlannerTurn[] = [
    ...session.turns,
    { role: "user", text: userText, createdAt: now },
    { role: "assistant", text: response.assistantMessage, createdAt: now },
  ];

  return planningRepository.appendTurnResult(session.id, {
    turns: nextTurns,
    draft: response.page,
    lastAssistantMessage: response.assistantMessage,
    readyToConfirm: response.readyToConfirm,
  });
}

/**
 * Diferente do objective-planning, a criação de verdade da página acontece
 * no FRONT (reaproveita createWorkspacePage + markdownToBlocks, que já
 * existem pro fluxo de "Importar Markdown" do Workspace) — aqui só fecha a
 * sessão e guarda o id da página criada pra rastreabilidade.
 */
export async function confirmSession(
  session: WorkspacePlanningSessionRow,
  createdPageId: string,
): Promise<WorkspacePlanningSessionRow> {
  if (session.status !== "active") throw new Error("Essa sessão de planejamento já foi encerrada.");
  return planningRepository.setStatus(session.id, "confirmed", createdPageId);
}

export async function cancelSession(session: WorkspacePlanningSessionRow): Promise<WorkspacePlanningSessionRow> {
  return planningRepository.setStatus(session.id, "cancelled");
}
