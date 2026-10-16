/**
 * Um item do plano. Em `tasks` ficam os níveis abaixo dele: num objetivo são os marcos, num marco as
 * issues, numa issue as subissues (no máximo 3 níveis abaixo do objetivo).
 */
export interface PlannerTaskDraft {
  title: string;
  description: string;
  dueDate: string | null;
  owner: string | null;
  /** vendas | marketing | administrativo | desenvolvimento. Sem valor, herda a do item pai. */
  area?: string | null;
  /** critica | alta | media | baixa */
  priority?: string | null;
  /** Já concluído (progresso 100). */
  done?: boolean;
  tasks?: PlannerTaskDraft[];
}

export interface PlannerObjectiveDraft extends PlannerTaskDraft {
  /** "task" = tarefa avulsa, sem objetivo pai — vira um card de topo igual um objetivo. */
  kind: "objective" | "task";
}

export interface PlannerTurn {
  role: "user" | "assistant";
  text: string;
  audioUrl?: string;
  createdAt: string;
}

/** Resposta (já validada) que a Groq devolve a cada turno de estruturação. */
export interface PlannerAiResponse {
  assistantMessage: string;
  readyToConfirm: boolean;
  objectives: PlannerObjectiveDraft[];
}

export interface PlanningSessionRow {
  id: string;
  owner_user_id: string;
  channel: "web" | "whatsapp";
  status: "active" | "confirmed" | "cancelled";
  turns: PlannerTurn[];
  draft: PlannerObjectiveDraft[];
  last_assistant_message: string | null;
  ready_to_confirm: boolean;
  created_objective_ids: string[] | null;
  created_at: string;
  updated_at: string;
}
