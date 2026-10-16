import type { CampaignLead, LeadBotStatus } from "@/lib/prospector";
import type { Lead } from "@/types";
import { formatShortDate } from "@/lib/objectiveMeta";

/** "+5521999990001" → "(21) 99999-0001". Fora do padrão brasileiro devolve como veio. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const national = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  if (national.length === 11) return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  if (national.length === 10) return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  return phone;
}

export const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  instagram: "Instagram",
  ifood: "iFood",
  instadelivery: "InstaDelivery",
};

// "contato" fica de fora de propósito: é o status que o disparador (ou o contato manual) dá a quem já foi
// abordado, então a linha mostra "Contatado", a mesma palavra do filtro.
const STAGE_LABELS: Record<string, string> = {
  qualificado: "Qualificado",
  negociacao: "Negociação",
  ganho: "Ganho",
  perdido: "Perdido",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Situação no bot (só existe pra leads de uma campanha). */
export type LeadBot = CampaignLead["bot"];

export type ContactState = "none" | "planned" | "queued" | "contacted" | "replied" | "failed" | "stage";

export interface LeadSituation {
  state: ContactState;
  label: string;
  /** Classes do chip (cor de fundo + texto). */
  className: string;
}

/**
 * Já houve conversa com o lead? O bot enviou, ele respondeu ou ele já saiu de "A Prospectar"
 * (contato manual, negociação...). Sem a situação do bot, vale só o estágio do funil.
 */
export function hasBeenContacted(lead: Lead, bot?: LeadBot): boolean {
  return bot?.status === "sent" || bot?.status === "replied" || lead.status !== "novo";
}

/**
 * O que mostrar como "situação" do contato: respondeu, o estágio comercial quando o lead já saiu de
 * "A Prospectar" (negociação, ganho...), contatado (pelo bot ou à mão) ou o que falta pro bot falar com ele.
 */
export function leadSituation(lead: Lead, bot?: LeadBot): LeadSituation {
  const botStatus: LeadBotStatus = bot?.status ?? "none";

  if (botStatus === "replied") return { state: "replied", label: "Respondeu", className: "bg-success/15 text-success" };
  if (lead.status !== "novo" && STAGE_LABELS[lead.status]) {
    return { state: "stage", label: STAGE_LABELS[lead.status], className: "bg-warning/20 text-foreground" };
  }
  if (botStatus === "sent" || lead.status === "contato") {
    return { state: "contacted", label: "Contatado", className: "bg-primary/10 text-primary" };
  }

  const byBot: Record<"none" | "planned" | "queued" | "failed", LeadSituation> = {
    // Pendente de ação: destaque quente, pra "ainda não falei" nunca parecer um estado apagado
    none: {
      state: "none",
      label: "Sem contato",
      className: "border border-warning/40 bg-warning/10 text-warning-foreground dark:text-warning",
    },
    planned: {
      state: "planned",
      label: bot?.date ? `Agendado · ${formatShortDate(bot.date).replace(".", "")}` : "Agendado",
      className: "bg-info/10 text-info",
    },
    queued: {
      state: "queued",
      label: bot?.date ? `Na fila · ${formatTime(bot.date)}` : "Na fila",
      className: "bg-info/10 text-info",
    },
    failed: { state: "failed", label: "Falhou", className: "bg-destructive/10 text-destructive" },
  };
  return byBot[botStatus as keyof typeof byBot];
}

/** Por que o lead NÃO pode ser enviado ao bot agora (null = pode). */
export function dispatchBlockedReason(lead: CampaignLead): string | null {
  if (!lead.phone) return "Sem WhatsApp — edite o lead para adicionar";
  if (lead.bot.status === "queued") return "Já está na fila de hoje";
  if (lead.bot.status === "sent" || lead.bot.status === "replied" || lead.status !== "novo") {
    return "Já foi contatado";
  }
  return null;
}
