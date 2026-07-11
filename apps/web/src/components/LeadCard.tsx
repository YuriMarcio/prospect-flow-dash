import { useDraggable } from "@dnd-kit/core";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Send,
  Star,
} from "lucide-react";
import type { Lead } from "@/types";
import { useLeadModalStore } from "@/store/leadModal";
import { LeadStageProgress } from "@/components/LeadStageProgress";

export interface BotDispatchInfo {
  status: "waiting" | "sending" | "sent" | "replied";
  sentAt?: string | null;
}

function minutesAgo(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

function botDispatchBadge(dispatch: BotDispatchInfo) {
  switch (dispatch.status) {
    case "sending":
      return { icon: <Send className="h-3 w-3" />, label: "enviando agora", cls: "text-primary" };
    case "sent":
      return {
        icon: <Check className="h-3 w-3" />,
        label: dispatch.sentAt ? `enviado há ${minutesAgo(dispatch.sentAt)} min` : "enviado",
        cls: "text-green-600",
      };
    case "replied":
      return { icon: <MessageSquare className="h-3 w-3" />, label: "respondeu", cls: "text-blue-600" };
    default:
      return { icon: <Clock className="h-3 w-3" />, label: "na fila", cls: "text-muted-foreground" };
  }
}

const CHANNEL_ICON: Record<NonNullable<Lead["prospectingChannel"]>, React.ReactNode> = {
  whatsapp: <MessageCircle className="h-3 w-3 text-green-500" />,
  instagram: <Instagram className="h-3 w-3 text-pink-500" />,
  email: <Mail className="h-3 w-3 text-blue-500" />,
};

const CHANNEL_LABEL: Record<NonNullable<Lead["prospectingChannel"]>, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  email: "E-mail",
};

function formatMeetingDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

interface LeadCardProps {
  lead: Lead;
  overlay?: boolean;
  botDispatch?: BotDispatchInfo;
}

export function LeadCard({ lead, overlay = false, botDispatch }: LeadCardProps) {
  const open = useLeadModalStore((s) => s.open);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
    disabled: overlay,
  });

  const hasPhone = lead.phone && lead.phone !== "";
  const isNegotiating = lead.status === "negociacao";
  const needsMeeting = isNegotiating && !lead.meetingAt;
  const meetingLabel = lead.meetingAt ? formatMeetingDate(lead.meetingAt) : null;
  const meetingIsPast = lead.meetingAt ? new Date(lead.meetingAt) < new Date() : false;
  const isSending = botDispatch?.status === "sending";
  const badge = botDispatch ? botDispatchBadge(botDispatch) : null;

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={(e) => {
        if (overlay || isDragging) return;
        e.stopPropagation();
        open(lead.id);
      }}
      className={`group relative rounded-lg border bg-card p-3 shadow-sm transition-[border-color,box-shadow,opacity,transform] touch-none select-none
        ${needsMeeting ? "border-yellow-500/50" : ""}
        ${isSending ? "border-primary bg-primary/5" : ""}
        ${
          overlay
            ? "cursor-grabbing shadow-xl ring-2 ring-primary/40 border-primary/30"
            : `cursor-grab active:cursor-grabbing hover:border-primary/30 hover:shadow-md hover:-translate-y-px ${needsMeeting || isSending ? "" : "border-border"}`
        }
        ${isDragging && !overlay ? "opacity-20 scale-95" : ""}`}
    >
      {/* Drag handle hint */}
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-lg opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "oklch(0.6 0.15 260 / 0.5)" }} />

      {/* Aviso: negociação sem reunião */}
      {needsMeeting && (
        <div className="flex items-center gap-1.5 mb-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 px-2 py-1">
          <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />
          <span className="text-[10px] font-medium text-yellow-600 dark:text-yellow-400">Reunião não agendada</span>
        </div>
      )}

      {/* Name + category */}
      <div className="pl-0.5">
        <h4 className={`text-sm font-semibold leading-snug truncate pr-1 ${isSending ? "text-primary" : ""}`}>
          {lead.companyName}
        </h4>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{lead.category}</p>
      </div>

      <LeadStageProgress status={lead.status} />

      {badge && (
        <div className={`mt-1.5 flex items-center gap-1 text-[11px] ${badge.cls}`}>
          {badge.icon}
          <span>{badge.label}</span>
        </div>
      )}

      {/* Reunião agendada */}
      {meetingLabel && (
        <div className={`mt-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium
          ${meetingIsPast
            ? "bg-muted/60 text-muted-foreground"
            : "bg-primary/10 text-primary border border-primary/20"}`}
        >
          <CalendarClock className="h-3 w-3 shrink-0" />
          <span>{meetingLabel}</span>
        </div>
      )}

      {/* Score + city */}
      <div className="mt-2.5 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Star className="h-3 w-3 fill-warning text-warning shrink-0" />
        <span className="font-semibold text-foreground tabular-nums">{lead.score}</span>
        <span className="mx-1 opacity-40">•</span>
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate">{lead.city}</span>
      </div>

      {/* Instagram + phone */}
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
        {lead.instagram ? (
          <span className="inline-flex items-center gap-1 truncate flex-1 min-w-0">
            <Instagram className="h-3 w-3 shrink-0 text-pink-500" />
            <span className="truncate">{lead.instagram}</span>
          </span>
        ) : (
          <span className="flex-1" />
        )}
        {hasPhone && (
          <span className="inline-flex items-center gap-1 shrink-0 text-green-600">
            <Phone className="h-3 w-3" />
          </span>
        )}
      </div>

      {/* Tags */}
      {lead.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground"
            >
              {t}
            </span>
          ))}
          {lead.tags.length > 3 && (
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground">
              +{lead.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/50 pt-1.5">
        <span className="truncate">{lead.owner.split(" ")[0]}</span>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {lead.prospectingChannel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-1.5 py-0.5">
              {CHANNEL_ICON[lead.prospectingChannel]}
              <span className="text-[10px] font-medium">{CHANNEL_LABEL[lead.prospectingChannel]}</span>
            </span>
          )}
          <span>{lead.lastInteraction}</span>
        </div>
      </div>
    </div>
  );
}
