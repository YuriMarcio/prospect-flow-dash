import { useDraggable } from "@dnd-kit/core";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock,
  ArrowRightLeft,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Send,
  Star,
} from "lucide-react";
import type { KanbanColumn, Lead } from "@/types";
import { useLeadModal } from "@/hooks/use-lead-modal";
import { LeadStageProgress } from "@/components/LeadStageProgress";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  /**
   * Versão para o celular: card enxuto, sem arrastar (o dedo precisa rolar a lista) e com o
   * botão "Mover" no lugar do drag-and-drop. Exige `columns` e `onMove`.
   */
  compact?: boolean;
  columns?: KanbanColumn[];
  onMove?: (columnId: string) => void;
}

export function LeadCard({ compact = false, columns = [], onMove, ...props }: LeadCardProps) {
  if (compact) return <LeadCardCompact lead={props.lead} botDispatch={props.botDispatch} columns={columns} onMove={onMove} />;
  return <LeadCardDraggable {...props} />;
}

function LeadCardCompact({
  lead,
  botDispatch,
  columns,
  onMove,
}: {
  lead: Lead;
  botDispatch?: BotDispatchInfo;
  columns: KanbanColumn[];
  onMove?: (columnId: string) => void;
}) {
  const { open } = useLeadModal();

  const needsMeeting = lead.status === "negociacao" && !lead.meetingAt;
  const meetingLabel = lead.meetingAt ? formatMeetingDate(lead.meetingAt) : null;
  const meetingIsPast = lead.meetingAt ? new Date(lead.meetingAt) < new Date() : false;
  const isSending = botDispatch?.status === "sending";
  const badge = botDispatch ? botDispatchBadge(botDispatch) : null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm",
        needsMeeting ? "border-yellow-500/50" : "border-border",
        isSending && "border-primary bg-primary/5",
      )}
    >
      <button
        type="button"
        onClick={() => open(lead.id)}
        className="block w-full space-y-1.5 px-3.5 pb-2.5 pt-3 text-left transition-colors active:bg-accent/40"
      >
        <div className="flex items-start gap-2">
          <h4 className={cn("min-w-0 flex-1 text-[15px] font-semibold leading-snug", isSending && "text-primary")}>
            {lead.companyName}
          </h4>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">
            <Star className="h-3 w-3 fill-warning text-warning" />
            {lead.score}
          </span>
        </div>

        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="truncate">{lead.category}</span>
          <span className="opacity-40">•</span>
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{lead.city}</span>
        </p>

        {(needsMeeting || meetingLabel || badge || lead.prospectingChannel) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {needsMeeting && (
              <span className="inline-flex items-center gap-1 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-[11px] font-medium text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="h-3 w-3" />
                Reunião não agendada
              </span>
            )}
            {meetingLabel && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium",
                  meetingIsPast ? "bg-muted/60 text-muted-foreground" : "border border-primary/20 bg-primary/10 text-primary",
                )}
              >
                <CalendarClock className="h-3 w-3" />
                {meetingLabel}
              </span>
            )}
            {badge && (
              <span className={cn("inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-[11px]", badge.cls)}>
                {badge.icon}
                {badge.label}
              </span>
            )}
            {lead.prospectingChannel && (
              <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] font-medium">
                {CHANNEL_ICON[lead.prospectingChannel]}
                {CHANNEL_LABEL[lead.prospectingChannel]}
              </span>
            )}
          </div>
        )}
      </button>

      <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3.5 py-1.5 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">
          {lead.owner.split(" ")[0]} · {lead.lastInteraction}
        </span>

        {onMove && columns.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="-mr-2 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent active:bg-accent"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                Mover
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" collisionPadding={12} className="min-w-52">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Mover para…</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((column) => (
                <DropdownMenuItem
                  key={column.id}
                  disabled={column.id === lead.columnId}
                  onClick={() => onMove(column.id)}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: column.color }} />
                  <span className="flex-1 truncate">{column.title}</span>
                  {column.id === lead.columnId && <Check className="h-4 w-4 text-muted-foreground" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

function LeadCardDraggable({ lead, overlay = false, botDispatch }: LeadCardProps) {
  const { open } = useLeadModal();
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
