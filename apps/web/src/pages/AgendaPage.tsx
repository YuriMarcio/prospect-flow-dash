import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CalendarX, Instagram, Mail, MessageCircle } from "lucide-react";
import { listLeads } from "@/lib/api";
import { useLeadModalStore } from "@/store/leadModal";
import type { Lead } from "@/types";

const CHANNEL_ICON: Record<NonNullable<Lead["prospectingChannel"]>, React.ReactNode> = {
  whatsapp: <MessageCircle className="h-3.5 w-3.5 text-green-500" />,
  instagram: <Instagram className="h-3.5 w-3.5 text-pink-500" />,
  email: <Mail className="h-3.5 w-3.5 text-blue-500" />,
};

const CHANNEL_LABEL: Record<NonNullable<Lead["prospectingChannel"]>, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  email: "E-mail",
};

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function formatDayLabel(dateKey: string) {
  const date = new Date(dateKey + "T12:00:00");
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

  if (isSameDay(date, today)) return "Hoje";
  if (isSameDay(date, tomorrow)) return "Amanhã";

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

function toDateKey(iso: string) {
  return iso.slice(0, 10); // "YYYY-MM-DD"
}

export function AgendaPage() {
  const open = useLeadModalStore((s) => s.open);

  const leadsQuery = useQuery({
    queryKey: ["leads"],
    queryFn: listLeads,
    retry: 1,
  });

  const leads = leadsQuery.data ?? [];

  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    const withMeeting = leads.filter((l) => l.meetingAt);
    const sorted = [...withMeeting].sort(
      (a, b) => new Date(a.meetingAt!).getTime() - new Date(b.meetingAt!).getTime(),
    );
    return {
      upcoming: sorted.filter((l) => new Date(l.meetingAt!) >= now),
      past: sorted.filter((l) => new Date(l.meetingAt!) < now).reverse(),
    };
  }, [leads]);

  function groupByDay(list: Lead[]) {
    const map = new Map<string, Lead[]>();
    for (const l of list) {
      const key = toDateKey(l.meetingAt!);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return map;
  }

  const upcomingGroups = groupByDay(upcoming);
  const pastGroups = groupByDay(past);

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reuniões agendadas com seus leads.
        </p>
      </div>

      {/* Próximas reuniões */}
      {upcoming.length === 0 && past.length === 0 && !leadsQuery.isLoading && (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <CalendarX className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhuma reunião agendada.</p>
          <p className="text-xs opacity-60">Mova um lead para a coluna de Negociação no Kanban para agendar.</p>
        </div>
      )}

      {upcomingGroups.size > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CalendarClock className="h-3.5 w-3.5" />
            Próximas
          </h2>
          {[...upcomingGroups.entries()].map(([dayKey, dayLeads]) => (
            <div key={dayKey}>
              <p className="text-sm font-medium mb-2 capitalize">{formatDayLabel(dayKey)}</p>
              <div className="space-y-2">
                {dayLeads.map((lead) => (
                  <MeetingCard key={lead.id} lead={lead} past={false} onClick={() => open(lead.id)} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Reuniões passadas */}
      {pastGroups.size > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Realizadas
          </h2>
          {[...pastGroups.entries()].map(([dayKey, dayLeads]) => (
            <div key={dayKey}>
              <p className="text-sm font-medium mb-2 capitalize text-muted-foreground">{formatDayLabel(dayKey)}</p>
              <div className="space-y-2">
                {dayLeads.map((lead) => (
                  <MeetingCard key={lead.id} lead={lead} past onClick={() => open(lead.id)} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function MeetingCard({
  lead,
  past,
  onClick,
}: {
  lead: Lead;
  past: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-colors
        ${past
          ? "border-border bg-muted/30 opacity-60 hover:opacity-80"
          : "border-border bg-card hover:border-primary/40 hover:shadow-sm"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-base font-semibold tabular-nums shrink-0 ${past ? "text-muted-foreground" : "text-primary"}`}>
              {formatTime(lead.meetingAt!)}
            </span>
            <span className="font-medium truncate">{lead.companyName}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{lead.category} • {lead.city}</p>
          {lead.meetingNotes && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 italic">"{lead.meetingNotes}"</p>
          )}
        </div>
        {lead.prospectingChannel && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-[11px] font-medium shrink-0">
            {CHANNEL_ICON[lead.prospectingChannel]}
            {CHANNEL_LABEL[lead.prospectingChannel]}
          </span>
        )}
      </div>
    </button>
  );
}
