export interface PageDraft {
  icon: string;
  title: string;
  description: string;
  /** Conteúdo em Markdown — vira blocos nativos no Workspace via markdownToBlocks() no front. */
  markdown: string;
}

export interface PlannerTurn {
  role: "user" | "assistant";
  text: string;
  audioUrl?: string;
  createdAt: string;
}

export interface PlannerAiResponse {
  assistantMessage: string;
  readyToConfirm: boolean;
  page: PageDraft | null;
}

export interface WorkspacePlanningSessionRow {
  id: string;
  owner_user_id: string;
  channel: "web" | "whatsapp";
  status: "active" | "confirmed" | "cancelled";
  turns: PlannerTurn[];
  draft: PageDraft | null;
  last_assistant_message: string | null;
  ready_to_confirm: boolean;
  created_page_id: string | null;
  created_at: string;
  updated_at: string;
}
