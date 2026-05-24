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
  status: "queued" | "running" | "done" | "error";
  processed: number;
  found: number;
  errors: number;
  duration: string;
  startedAt: string;
  logs: { time: string; message: string; level: "info" | "warn" | "error" }[];
}
