import { request } from "@/lib/api";

export interface PlannerTaskDraft {
  title: string;
  description: string;
  dueDate: string | null;
  owner: string | null;
}

export interface PlannerObjectiveDraft {
  /** "task" = tarefa avulsa, sem objetivo pai. */
  kind: "objective" | "task";
  title: string;
  description: string;
  dueDate: string | null;
  owner: string | null;
  tasks: PlannerTaskDraft[];
}

export interface PlannerTurn {
  role: "user" | "assistant";
  text: string;
  audioUrl?: string;
  createdAt: string;
}

export interface PlanningSession {
  id: string;
  ownerUserId: string;
  channel: "web" | "whatsapp";
  status: "active" | "confirmed" | "cancelled";
  turns: PlannerTurn[];
  draft: PlannerObjectiveDraft[];
  lastAssistantMessage: string | null;
  readyToConfirm: boolean;
  createdObjectiveIds: string[] | null;
}

interface PlanningSessionRow {
  id: string;
  owner_user_id: string;
  channel: "web" | "whatsapp";
  status: "active" | "confirmed" | "cancelled";
  turns: PlannerTurn[];
  draft: PlannerObjectiveDraft[];
  last_assistant_message: string | null;
  ready_to_confirm: boolean;
  created_objective_ids: string[] | null;
}

function fromRow(row: PlanningSessionRow): PlanningSession {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    channel: row.channel,
    status: row.status,
    turns: row.turns,
    draft: row.draft,
    lastAssistantMessage: row.last_assistant_message,
    readyToConfirm: row.ready_to_confirm,
    createdObjectiveIds: row.created_objective_ids,
  };
}

export async function getActivePlanningSession(): Promise<PlanningSession> {
  const row = await request<PlanningSessionRow>("/objective-planning/session");
  return fromRow(row);
}

export async function sendPlannerTurn(sessionId: string, text: string): Promise<PlanningSession> {
  const row = await request<PlanningSessionRow>(`/objective-planning/session/${sessionId}/turns`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  return fromRow(row);
}

export async function confirmPlanningSession(
  sessionId: string,
  columnId: string,
): Promise<{ session: PlanningSession; createdObjectiveIds: string[] }> {
  const result = await request<{ session: PlanningSessionRow; createdObjectiveIds: string[] }>(
    `/objective-planning/session/${sessionId}/confirm`,
    { method: "POST", body: JSON.stringify({ columnId }) },
  );
  return { session: fromRow(result.session), createdObjectiveIds: result.createdObjectiveIds };
}

export async function cancelPlanningSession(sessionId: string): Promise<PlanningSession> {
  const row = await request<PlanningSessionRow>(`/objective-planning/session/${sessionId}/cancel`, {
    method: "POST",
  });
  return fromRow(row);
}
