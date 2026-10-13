import type { CampaignLead, LeadBotStatus } from "@/lib/prospector";
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

// "contato" fica de fora de propósito: é o status que o próprio disparador dá a quem recebeu a mensagem,
// então a linha mostra "Contatado" (a situação no bot), a mesma palavra do filtro.
const STAGE_LABELS: Record<string, string> = {
  qualificado: "Qualificado",
  negociacao: "Negociação",
  ganho: "Ganho",
  perdido: "Perdido",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export interface LeadSituation {
  label: string;
  /** Classes do chip (cor de fundo + texto). */
  className: string;
}

/**
 * O que mostrar na coluna "Situação": o estágio comercial quando o lead já saiu de "A Prospectar"
 * (negociação, ganho...), senão a situação no bot.
 */
export function leadSituation(lead: CampaignLead): LeadSituation {
  const bot = lead.bot;
  if (bot.status === "replied") return { label: "Respondeu", className: "bg-success/15 text-success" };
  if (lead.status !== "novo" && STAGE_LABELS[lead.status]) {
    return { label: STAGE_LABELS[lead.status], className: "bg-warning/20 text-foreground" };
  }

  const byBot: Record<LeadBotStatus, LeadSituation> = {
    none: { label: "Sem contato", className: "bg-muted text-muted-foreground" },
    planned: {
      label: bot.date ? `Agendado · ${formatShortDate(bot.date).replace(".", "")}` : "Agendado",
      className: "bg-info/10 text-info",
    },
    queued: {
      label: bot.date ? `Na fila · ${formatTime(bot.date)}` : "Na fila",
      className: "bg-info/10 text-info",
    },
    sent: { label: "Contatado", className: "bg-primary/10 text-primary" },
    replied: { label: "Respondeu", className: "bg-success/15 text-success" },
    failed: { label: "Falhou", className: "bg-destructive/10 text-destructive" },
  };
  return byBot[bot.status];
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
