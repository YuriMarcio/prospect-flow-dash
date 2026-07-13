import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, Eraser, Search, Star, User } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  getCampaign,
  listDispatchPlan,
  assignLeadToDay,
  unassignLeadFromDay,
  clearCampaignLeads,
  type DispatchPlanItem,
  type DispatchQueueItem,
} from "@/lib/prospector";
import type { Lead } from "@/types";
import { LeadCard, type BotDispatchInfo } from "@/components/LeadCard";

const WEEKDAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;

/** Acima disso num único dia o risco de bloqueio do número sobe muito. */
const BAN_RISK_LIMIT = 30;
/** Zona de atenção antes do limite de risco. */
const WARN_LIMIT = 25;
/** Corta a lista de já prospectados pra não pesar o board com meses de histórico. */
const PROSPECTED_VISIBLE_LIMIT = 150;

// Referência estável pro fallback de "ainda sem dados" — evitar criar um
// array novo a cada render, o que faria os useMemo que dependem de `plan`
// recalcular sem necessidade.
const EMPTY_PLAN: DispatchPlanItem[] = [];

type DayRisk = "red" | "amber" | null;

function riskForDay(count: number, dayLimit: number): DayRisk {
  if (count > BAN_RISK_LIMIT) return "red";
  if (count > WARN_LIMIT || count > dayLimit) return "amber";
  return null;
}
const WEEKDAY_LABELS: Record<(typeof WEEKDAY_KEYS)[number], string> = {
  dom: "Dom",
  seg: "Seg",
  ter: "Ter",
  qua: "Qua",
  qui: "Qui",
  sex: "Sex",
  sab: "Sáb",
};

function normalizeForMatch(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatDayLabel(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${WEEKDAY_LABELS[WEEKDAY_KEYS[date.getDay()]]} ${dd}/${mm}`;
}

function dateLabelForKey(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return "Hoje";
  return formatDayLabel(parseDateKey(dateKey));
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function riskChipClass(risk: DayRisk): string {
  if (risk === "red") return "border-red-500/50 bg-red-500/10 text-red-500";
  if (risk === "amber") return "border-amber-500/50 bg-amber-500/10 text-amber-600";
  return "border-border bg-muted text-muted-foreground";
}

function DraggableChip({
  lead,
  locked,
  botDispatch,
}: {
  lead: Lead;
  locked?: boolean;
  botDispatch?: BotDispatchInfo;
}) {
  // Já enviado/enviando: mover o card não cancela o disparo real, então trava
  // o arraste pra não criar um card fantasma duplicado.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
    disabled: locked,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      title={locked ? "Já enviado — não pode ser movido" : undefined}
      className={`touch-none ${isDragging ? "opacity-30" : ""} ${locked ? "cursor-not-allowed" : ""}`}
    >
      <LeadCard lead={lead} botDispatch={botDispatch} />
    </div>
  );
}

function DroppableColumn({
  id,
  title,
  subtitle,
  children,
  count,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  count: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      className={`flex w-72 shrink-0 flex-col rounded-xl border h-full transition-colors ${
        isOver ? "border-primary/50 bg-primary/5" : "border-border bg-muted/30"
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate">{title}</h3>
          {subtitle && <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>}
        </div>
        <span className="text-xs font-medium rounded-full px-1.5 py-0.5 min-w-5 text-center text-muted-foreground bg-muted">
          {count}
        </span>
      </div>
      <div ref={setNodeRef} className="flex-1 min-h-0 p-2 space-y-2 overflow-y-auto">
        {children}
        {count === 0 && (
          <div className="flex items-center justify-center h-16 text-[11px] text-muted-foreground border border-dashed border-border/60 rounded-lg">
            Solte aqui
          </div>
        )}
      </div>
    </div>
  );
}

function StaticColumn({
  title,
  subtitle,
  children,
  count,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  count: number;
}) {
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30 h-full">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate">{title}</h3>
          {subtitle && <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>}
        </div>
        <span className="text-xs font-medium rounded-full px-1.5 py-0.5 min-w-5 text-center text-muted-foreground bg-muted">
          {count}
        </span>
      </div>
      <div className="flex-1 min-h-0 p-2 space-y-2 overflow-y-auto">
        {children}
        {count === 0 && (
          <div className="flex items-center justify-center h-16 text-[11px] text-muted-foreground border border-dashed border-border/60 rounded-lg">
            Ninguém prospectado ainda
          </div>
        )}
      </div>
    </div>
  );
}

export function BotWeekBoard({
  campaignId,
  leads,
  dispatchHistory,
}: {
  campaignId: string;
  leads: Lead[];
  dispatchHistory: DispatchQueueItem[];
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const configQuery = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: () => getCampaign(campaignId),
  });
  const planQuery = useQuery({
    queryKey: ["bot-plan", campaignId],
    queryFn: () => listDispatchPlan(campaignId),
    refetchInterval: 8000,
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const todayKey = toDateKey(new Date());

  // Próximos dias habilitados na agenda — usado só como candidatos pra
  // distribuição automática e pro seletor de dia de cada card, não mais como
  // colunas separadas (essas somem/deslizam com o tempo, o que escondia leads
  // já prospectados).
  const days = useMemo(() => {
    const schedule = configQuery.data?.schedule;
    const result: { dateKey: string; label: string; limit: number }[] = [];
    for (let i = 0; i < 7 && result.length < 5; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const key = WEEKDAY_KEYS[date.getDay()];
      const daySchedule = schedule?.[key as keyof typeof schedule];
      if (schedule && !daySchedule?.enabled) continue;
      result.push({
        dateKey: toDateKey(date),
        label: formatDayLabel(date),
        limit: daySchedule?.limit ?? 0,
      });
    }
    return result;
  }, [configQuery.data]);

  const plan = planQuery.data ?? EMPTY_PLAN;
  const filters = configQuery.data?.filters;
  const leadsById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  // Lead com pelo menos um envio já feito (sent/replied) nesta campanha —
  // esses ficam permanentemente em "Prospectados", mesmo que tenham um
  // follow-up novo aguardando (o card reflete o status mais recente).
  const everSentLeadIds = useMemo(() => {
    const set = new Set<string>();
    for (const item of dispatchHistory) {
      if (item.status === "sent" || item.status === "replied") set.add(item.lead_id);
    }
    return set;
  }, [dispatchHistory]);

  // Ignora itens "failed" na hora de escolher o mais recente — um envio que
  // falhou não deve virar o status exibido do card (o badge não sabe
  // representar "failed"; o histórico completo já fica no card do lead).
  const latestByLeadId = useMemo(() => {
    const map = new Map<string, DispatchQueueItem>();
    for (const item of dispatchHistory) {
      if (item.status === "failed") continue;
      const existing = map.get(item.lead_id);
      if (
        !existing ||
        new Date(item.scheduled_at).getTime() > new Date(existing.scheduled_at).getTime()
      ) {
        map.set(item.lead_id, item);
      }
    }
    return map;
  }, [dispatchHistory]);

  // Todo lead já vinculado à campanha (planejado ou com algum envio) — não
  // pode mais aparecer em "Disponíveis".
  const assignedLeadIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of plan) ids.add(p.lead_id);
    for (const item of dispatchHistory) ids.add(item.lead_id);
    return ids;
  }, [plan, dispatchHistory]);

  const q = search.trim().toLowerCase();
  function matchesSearch(leadId: string): boolean {
    if (!q) return true;
    const lead = leadsById.get(leadId);
    return Boolean(lead?.companyName.toLowerCase().includes(q));
  }

  const pool = useMemo(() => {
    const cityFilters = filters?.cities.map(normalizeForMatch) ?? [];
    const segmentFilters = filters?.segments.map(normalizeForMatch) ?? [];
    return leads.filter((l) => {
      if (l.status !== "novo" || !l.phone) return false;
      if (assignedLeadIds.has(l.id)) return false;
      if (cityFilters.length && !cityFilters.includes(normalizeForMatch(l.city ?? "")))
        return false;
      if (segmentFilters.length && !segmentFilters.includes(normalizeForMatch(l.category ?? "")))
        return false;
      if (q && !l.companyName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [leads, assignedLeadIds, q, filters]);

  // "Agendados": ainda não receberam a primeira mensagem — vem do plano
  // (dias futuros) ou de itens já na fila de hoje aguardando envio.
  const scheduled = useMemo(() => {
    const entries: {
      leadId: string;
      dateKey: string;
      queueStatus?: Extract<DispatchQueueItem["status"], "waiting" | "sending">;
    }[] = [];
    const seen = new Set<string>();
    for (const p of plan) {
      if (everSentLeadIds.has(p.lead_id) || seen.has(p.lead_id)) continue;
      seen.add(p.lead_id);
      entries.push({ leadId: p.lead_id, dateKey: p.planned_date });
    }
    for (const item of dispatchHistory) {
      if (item.status !== "waiting" && item.status !== "sending") continue;
      if (everSentLeadIds.has(item.lead_id) || seen.has(item.lead_id)) continue;
      seen.add(item.lead_id);
      entries.push({
        leadId: item.lead_id,
        dateKey: toDateKey(new Date(item.scheduled_at)),
        queueStatus: item.status,
      });
    }
    return entries
      .filter((e) => matchesSearch(e.leadId))
      .sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesSearch depende de leadsById/q, já cobertos abaixo
  }, [plan, dispatchHistory, everSentLeadIds, leadsById, q]);

  const scheduledCountByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of scheduled) counts.set(e.dateKey, (counts.get(e.dateKey) ?? 0) + 1);
    return counts;
  }, [scheduled]);

  const riskyDays = useMemo(
    () =>
      days
        .map((day) => ({
          day,
          risk: riskForDay(scheduledCountByDate.get(day.dateKey) ?? 0, day.limit),
        }))
        .filter((d): d is { day: (typeof days)[number]; risk: DayRisk } => Boolean(d.risk)),
    [days, scheduledCountByDate],
  );

  // "Prospectados": já receberam pelo menos uma mensagem — fica pra sempre
  // aqui (não some com o tempo), com quem respondeu sempre no topo.
  const prospected = useMemo(() => {
    const rows = [...everSentLeadIds]
      .filter((leadId) => matchesSearch(leadId))
      .map((leadId) => ({ leadId, item: latestByLeadId.get(leadId) }))
      .filter((r): r is { leadId: string; item: DispatchQueueItem } => Boolean(r.item));

    rows.sort((a, b) => {
      const aReplied = a.item.status === "replied" ? 0 : 1;
      const bReplied = b.item.status === "replied" ? 0 : 1;
      if (aReplied !== bReplied) return aReplied - bReplied;
      const aTime = new Date(a.item.sent_at ?? a.item.scheduled_at).getTime();
      const bTime = new Date(b.item.sent_at ?? b.item.scheduled_at).getTime();
      return bTime - aTime;
    });
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- matchesSearch depende de leadsById/q, já cobertos abaixo
  }, [everSentLeadIds, latestByLeadId, leadsById, q]);

  const assignMutation = useMutation({
    mutationFn: (input: { leadId: string; date: string }) =>
      assignLeadToDay({ ...input, campaignId }),
    onSuccess: (result, variables) => {
      if (!result.ok) {
        toast.error(result.reason ?? "Não foi possível adicionar o lead.");
      } else {
        toast.success(variables.date === todayKey ? "Adicionado à fila de hoje." : "Planejado.");
      }
      queryClient.invalidateQueries({ queryKey: ["bot-plan", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["bot-queue", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["bot-queue-history", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-status", campaignId] });
    },
    onError: () => toast.error("Não foi possível adicionar o lead."),
  });

  const unassignMutation = useMutation({
    mutationFn: unassignLeadFromDay,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-plan", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["bot-queue", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["bot-queue-history", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-status", campaignId] });
    },
  });

  /**
   * Distribuição automática em segundo plano: sempre que aparece lead novo em
   * "Disponíveis" com vaga sobrando (respeitando o limite seguro de cada dia),
   * ele já entra no melhor dia sozinho — sem precisar clicar em nada. Um lead
   * só é tentado uma vez (sucesso ou falha); cards já movidos manualmente
   * nunca são tocados por aqui, e o usuário pode sempre trocar o dia pelo chip.
   */
  const autoAssignedRef = useRef<Set<string>>(new Set());

  const autoDistributeMutation = useMutation({
    mutationFn: async (assignments: { leadId: string; date: string }[]) => {
      let assigned = 0;
      for (const assignment of assignments) {
        const result = await assignLeadToDay({ ...assignment, campaignId });
        if (result.ok) assigned++;
      }
      return assigned;
    },
    onSuccess: (assigned) => {
      if (assigned > 0) {
        toast.success(
          `${assigned} lead${assigned > 1 ? "s" : ""} distribuído${assigned > 1 ? "s" : ""} automaticamente pela semana.`,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["bot-plan", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["bot-queue", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["bot-queue-history", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-status", campaignId] });
    },
  });

  useEffect(() => {
    if (days.length === 0 || autoDistributeMutation.isPending) return;

    const candidates = pool.filter((lead) => !autoAssignedRef.current.has(lead.id));
    if (candidates.length === 0) return;

    const used = new Map<string, number>();
    for (const day of days) used.set(day.dateKey, scheduledCountByDate.get(day.dateKey) ?? 0);

    const assignments: { leadId: string; date: string }[] = [];
    for (const lead of candidates) {
      const target = days.find(
        (day) => (used.get(day.dateKey) ?? 0) < Math.min(day.limit, BAN_RISK_LIMIT),
      );
      if (!target) break; // sem vaga segura em nenhum dia — o resto fica em Disponíveis
      used.set(target.dateKey, (used.get(target.dateKey) ?? 0) + 1);
      assignments.push({ leadId: lead.id, date: target.dateKey });
    }

    if (assignments.length === 0) return;
    for (const assignment of assignments) autoAssignedRef.current.add(assignment.leadId);
    autoDistributeMutation.mutate(assignments);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda a cada mudança de pool/days; o ref evita retrabalho
  }, [pool, days, scheduledCountByDate]);

  const clearMutation = useMutation({
    mutationFn: () => clearCampaignLeads(campaignId),
    onSuccess: () => {
      toast.success(
        "Leads da campanha liberados — vínculo removido e envios pendentes cancelados.",
      );
      queryClient.invalidateQueries({ queryKey: ["bot-plan", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["bot-queue", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["bot-queue-history", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-status", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Não foi possível limpar os leads."),
  });

  function assignToNearestDay(leadId: string) {
    const used = new Map<string, number>();
    for (const day of days) used.set(day.dateKey, scheduledCountByDate.get(day.dateKey) ?? 0);
    const target = days.find(
      (day) => (used.get(day.dateKey) ?? 0) < Math.min(day.limit, BAN_RISK_LIMIT),
    );
    if (!target) {
      toast.error("Sem vaga segura nos próximos dias habilitados.");
      return;
    }
    assignMutation.mutate({ leadId, date: target.dateKey });
  }

  function onDragEnd(e: DragEndEvent) {
    const overId = e.over?.id as string | undefined;
    const leadId = e.active.id as string;
    if (!overId) return;

    if (overId === "pool") {
      unassignMutation.mutate(leadId);
      return;
    }
    if (overId === "scheduled") {
      assignToNearestDay(leadId);
    }
  }

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center gap-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar lead por nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs max-w-xs"
        />
        <span className="text-xs text-muted-foreground ml-1">
          Arraste da lista de disponíveis para agendar · novos leads são distribuídos
          automaticamente · troque o dia pelo chip no card
        </span>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs text-destructive hover:text-destructive ml-auto"
              disabled={clearMutation.isPending}
            >
              <Eraser className="h-3.5 w-3.5" />
              {clearMutation.isPending ? "Limpando…" : "Limpar leads"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Limpar os leads desta campanha?</AlertDialogTitle>
              <AlertDialogDescription>
                Remove o vínculo de todos os leads com a campanha, cancela os envios pendentes na
                fila e limpa o plano da semana. Os leads mantêm o status e a coluna atual no Kanban
                geral, e o histórico de conversas fica registrado. Eles voltam a aparecer em
                "Disponíveis" para qualquer campanha.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => clearMutation.mutate()}>Limpar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {filters?.cities.length || filters?.segments.length ? (
          <span className="text-[11px] text-primary bg-primary/10 rounded-full px-2 py-0.5">
            Filtrando por: {[...filters.cities, ...filters.segments].join(", ")}
          </span>
        ) : null}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 flex-1 min-h-0">
          <DroppableColumn
            id="pool"
            title="Disponíveis"
            subtitle="leads elegíveis"
            count={pool.length}
          >
            {pool.slice(0, 50).map((lead) => (
              <DraggableChip key={lead.id} lead={lead} />
            ))}
          </DroppableColumn>

          <DroppableColumn
            id="scheduled"
            title="Agendados"
            subtitle="aguardando a primeira mensagem"
            count={scheduled.length}
          >
            {riskyDays.length > 0 && (
              <div className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[10px] text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                <span>
                  {riskyDays
                    .map(({ day, risk }) => `${day.label}${risk === "red" ? " (risco alto)" : ""}`)
                    .join(" · ")}{" "}
                  perto ou acima do limite seguro.
                </span>
              </div>
            )}
            {scheduled.map(({ leadId, dateKey, queueStatus }) => {
              const lead = leadsById.get(leadId);
              if (!lead) return null;
              const risk = riskForDay(
                scheduledCountByDate.get(dateKey) ?? 0,
                days.find((d) => d.dateKey === dateKey)?.limit ?? 0,
              );
              const locked = queueStatus === "sending";
              return (
                <div key={leadId} className="space-y-1">
                  <div className="flex items-center justify-end">
                    {locked ? (
                      <span className="text-[10px] text-primary font-medium px-1.5">
                        enviando agora
                      </span>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${riskChipClass(risk)}`}
                          >
                            {dateLabelForKey(dateKey, todayKey)}
                            <ChevronDown className="h-2.5 w-2.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {days.map((day) => (
                            <DropdownMenuItem
                              key={day.dateKey}
                              onSelect={() => assignMutation.mutate({ leadId, date: day.dateKey })}
                            >
                              {day.label} · {scheduledCountByDate.get(day.dateKey) ?? 0}/{day.limit}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <DraggableChip
                    lead={lead}
                    locked={locked}
                    botDispatch={queueStatus ? { status: queueStatus, sentAt: null } : undefined}
                  />
                </div>
              );
            })}
          </DroppableColumn>

          <StaticColumn
            title="Prospectados"
            subtitle="quem respondeu fica no topo"
            count={prospected.length}
          >
            {prospected.slice(0, PROSPECTED_VISIBLE_LIMIT).map(({ leadId, item }) => {
              const lead = leadsById.get(leadId);
              if (!lead) return null;
              const replied = item.status === "replied";
              return (
                <div key={leadId} className="space-y-1">
                  <div className="flex items-center justify-between px-0.5">
                    {replied ? (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-blue-600">
                        <Star className="h-3 w-3 fill-current" />
                        Prioridade
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {formatShortDate(item.sent_at ?? item.scheduled_at)}
                    </span>
                  </div>
                  <DraggableChip
                    lead={lead}
                    locked
                    botDispatch={{
                      status: item.status as Exclude<DispatchQueueItem["status"], "failed">,
                      sentAt: item.sent_at,
                    }}
                  />
                </div>
              );
            })}
            {prospected.length > PROSPECTED_VISIBLE_LIMIT && (
              <p className="text-[10px] text-muted-foreground text-center py-1">
                +{prospected.length - PROSPECTED_VISIBLE_LIMIT} ocultos (use a busca)
              </p>
            )}
          </StaticColumn>
        </div>
      </DndContext>

      {pool.length === 0 && (
        <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
          <User className="h-3 w-3" />
          Nenhum lead disponível com esse filtro.
        </p>
      )}
    </div>
  );
}
