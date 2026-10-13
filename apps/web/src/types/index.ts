export type LeadStatus = "novo" | "contato" | "qualificado" | "negociacao" | "ganho" | "perdido";

export interface Lead {
  id: string;
  companyName: string;
  cnpj?: string;
  category: string;
  city: string;
  address?: string;
  phone: string;
  instagram?: string;
  instagramBio?: string;
  followers?: number;
  links?: string[];
  score: number;
  status: LeadStatus;
  tags: string[];
  owner: string;
  columnId: string;
  lastInteraction: string;
  nextFollowUp?: string;
  timeline: TimelineEvent[];
  createdAt?: string;
  prospectingChannel?: "whatsapp" | "instagram" | "email";
  meetingAt?: string;
  meetingNotes?: string;
  /** De onde veio o lead: "manual", "instagram", "ifood" ou "instadelivery". */
  source?: string;
  /** Campanha de prospecção (painel do território) a que ele pertence; vazio = Kanban geral. */
  prospectingCampaignId?: string | null;
  notes?: string;
}

export interface TimelineEvent {
  id: string;
  type: "call" | "note" | "move" | "contact" | "create";
  title: string;
  description?: string;
  date: string;
  author: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  order: number;
}

export interface Capture {
  id: string;
  category: string;
  city: string;
  neighborhood?: string;
  quantity: number;
  delay: number;
  limit: number;
  status: "queued" | "running" | "done" | "error" | "cancelled";
  /** Por que uma captura concluída parou: meta atingida, fontes esgotadas ou limite de buscas. */
  completionReason?: "goal_reached" | "sources_exhausted" | "budget_exhausted";
  processed: number;
  found: number;
  errors: number;
  duration: string;
  startedAt: string;
  /** ISO timestamp antes da formatação — usado para estimativas de tempo (startedAt já vem formatado e não é reparseável). */
  startedAtRaw?: string;
  logs: { time: string; message: string; level: "info" | "warn" | "error" }[];
}
