import { request } from "@/lib/api";

export interface PageDraft {
  icon: string;
  title: string;
  description: string;
  markdown: string;
}

export interface PlannerTurn {
  role: "user" | "assistant";
  text: string;
  audioUrl?: string;
  createdAt: string;
}

export interface WorkspacePlanningSession {
  id: string;
  ownerUserId: string;
  channel: "web" | "whatsapp";
  status: "active" | "confirmed" | "cancelled";
  turns: PlannerTurn[];
  draft: PageDraft | null;
  lastAssistantMessage: string | null;
  readyToConfirm: boolean;
  createdPageId: string | null;
}

interface WorkspacePlanningSessionRow {
  id: string;
  owner_user_id: string;
  channel: "web" | "whatsapp";
  status: "active" | "confirmed" | "cancelled";
  turns: PlannerTurn[];
  draft: PageDraft | null;
  last_assistant_message: string | null;
  ready_to_confirm: boolean;
  created_page_id: string | null;
}

function fromRow(row: WorkspacePlanningSessionRow): WorkspacePlanningSession {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    channel: row.channel,
    status: row.status,
    turns: row.turns,
    draft: row.draft,
    lastAssistantMessage: row.last_assistant_message,
    readyToConfirm: row.ready_to_confirm,
    createdPageId: row.created_page_id,
  };
}

export async function getActiveWorkspacePlanningSession(): Promise<WorkspacePlanningSession> {
  const row = await request<WorkspacePlanningSessionRow>("/workspace-planning/session");
  return fromRow(row);
}

export async function sendWorkspacePlannerTurn(sessionId: string, text: string): Promise<WorkspacePlanningSession> {
  const row = await request<WorkspacePlanningSessionRow>(`/workspace-planning/session/${sessionId}/turns`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  return fromRow(row);
}

export async function confirmWorkspacePlanningSession(
  sessionId: string,
  createdPageId: string,
): Promise<WorkspacePlanningSession> {
  const row = await request<WorkspacePlanningSessionRow>(`/workspace-planning/session/${sessionId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ createdPageId }),
  });
  return fromRow(row);
}

export async function cancelWorkspacePlanningSession(sessionId: string): Promise<WorkspacePlanningSession> {
  const row = await request<WorkspacePlanningSessionRow>(`/workspace-planning/session/${sessionId}/cancel`, {
    method: "POST",
  });
  return fromRow(row);
}
