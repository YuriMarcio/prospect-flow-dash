import { useMemo, useState } from "react";
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
import { AlertTriangle, Eraser, ListRestart, Search, Shuffle, User } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
} from "@/lib/prospector";
import type { Lead } from "@/types";
import { LeadCard, type BotDispatchInfo } from "@/components/LeadCard";

const WEEKDAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;

/** Acima disso num único dia o risco de bloqueio do número sobe muito. */
const BAN_RISK_LIMIT = 30;
/** Zona de atenção antes do limite de risco. */
const WARN_LIMIT = 25;

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

function formatDayLabel(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${WEEKDAY_LABELS[WEEKDAY_KEYS[date.getDay()]]} ${dd}/${mm}`;
}

function DraggableChip({ lead, botDispatch }: { lead: Lead; botDispatch?: BotDispatchInfo }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`touch-none ${isDragging ? "opacity-30" : ""}`}
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
  risk = null,
  riskLabel,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  count: number;
  risk?: DayRisk;
  riskLabel?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const baseColor =
    risk === "red"
      ? "border-red-500/60 bg-red-500/10"
      : risk === "amber"
        ? "border-amber-500/60 bg-amber-500/10"
        : "border-border bg-muted/30";

  return (
    <div
      className={`flex w-60 shrink-0 flex-col rounded-xl border h-full transition-colors ${
        isOver ? "border-primary/50 bg-primary/5" : baseColor
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate">{title}</h3>
          {subtitle && <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>}
        </div>
        <span
          className={`text-xs font-medium rounded-full px-1.5 py-0.5 min-w-5 text-center ${
            risk === "red"
              ? "bg-red-500/20 text-red-500"
              : risk === "amber"
                ? "bg-amber-500/20 text-amber-600"
                : "text-muted-foreground bg-muted"
          }`}
        >
          {count}
        </span>
      </div>
      {risk && riskLabel && (
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] border-b border-border ${
            risk === "red" ? "text-red-500" : "text-amber-600"
          }`}
        >
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {riskLabel}
        </div>
      )}
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

export function BotWeekBoard({
  campaignId,
  leads,
  botDispatchByLeadId,
}: {
  campaignId: string;
  leads: Lead[];
  botDispatchByLeadId: Record<string, BotDispatchInfo>;
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

  const plan = planQuery.data ?? [];
  const assignedLeadIds = useMemo(() => {
    const ids = new Set(plan.map((p: DispatchPlanItem) => p.lead_id));
    for (const leadId of Object.keys(botDispatchByLeadId)) ids.add(leadId);
    return ids;
  }, [plan, botDispatchByLeadId]);

  const filters = configQuery.data?.filters;

  const pool = useMemo(() => {
    const q = search.trim().toLowerCase();
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
  }, [leads, assignedLeadIds, search, filters]);

  const leadsById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  function leadIdsForDay(dateKey: string): string[] {
    const planned = plan
      .filter((p: DispatchPlanItem) => p.planned_date === dateKey)
      .map((p) => p.lead_id);
    if (dateKey !== todayKey) return planned;
    const queuedToday = Object.keys(botDispatchByLeadId);
    return [...new Set([...planned, ...queuedToday])];
  }

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
      queryClient.invalidateQueries({ queryKey: ["campaign-status", campaignId] });
    },
    onError: () => toast.error("Não foi possível adicionar o lead."),
  });

  const unassignMutation = useMutation({
    mutationFn: unassignLeadFromDay,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bot-plan", campaignId] }),
  });

  const distributeMutation = useMutation({
    mutationFn: async () => {
      const remainingPool = [...pool];
      const assignments: { leadId: string; date: string }[] = [];

      for (const day of days) {
        let openSlots = day.limit - leadIdsForDay(day.dateKey).length;
        while (openSlots > 0 && remainingPool.length > 0) {
          const lead = remainingPool.shift()!;
          assignments.push({ leadId: lead.id, date: day.dateKey });
          openSlots--;
        }
      }

      for (const assignment of assignments) {
        await assignLeadToDay({ ...assignment, campaignId });
      }
      return { assigned: assignments.length, leftover: remainingPool.length };
    },
    onSuccess: ({ assigned, leftover }) => {
      if (assigned === 0) {
        toast.info(
          "Nenhuma vaga disponível nos dias configurados — ajuste o limite na aba Agenda.",
        );
      } else {
        toast.success(
          leftover > 0
            ? `${assigned} leads distribuídos. ${leftover} ficaram em Disponíveis (limite do dia atingido).`
            : `${assigned} leads distribuídos pela semana.`,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["bot-plan", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["bot-queue", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-status", campaignId] });
    },
    onError: () => toast.error("Não foi possível distribuir os leads."),
  });

  /**
   * Rebalanceia os leads já planejados entre os dias, respeitando o limite
   * seguro de cada dia (min(limite, 30)). Excedente que não couber na semana
   * volta para "Disponíveis". O que já entrou na fila de hoje não se move.
   */
  const reorganizeMutation = useMutation({
    mutationFn: async () => {
      const used = new Map<string, number>();
      for (const day of days) {
        used.set(
          day.dateKey,
          day.dateKey === todayKey ? Object.keys(botDispatchByLeadId).length : 0,
        );
      }

      const plannedInOrder: DispatchPlanItem[] = days.flatMap((day) =>
        plan.filter((p) => p.planned_date === day.dateKey),
      );

      const moves: { leadId: string; date: string }[] = [];
      const overflow: string[] = [];

      for (const item of plannedInOrder) {
        const target = days.find((day) => {
          const cap = Math.min(day.limit, BAN_RISK_LIMIT);
          return (used.get(day.dateKey) ?? 0) < cap;
        });
        if (!target) {
          overflow.push(item.lead_id);
          continue;
        }
        used.set(target.dateKey, (used.get(target.dateKey) ?? 0) + 1);
        if (target.dateKey !== item.planned_date) {
          moves.push({ leadId: item.lead_id, date: target.dateKey });
        }
      }

      let failed = 0;
      for (const move of moves) {
        const result = await assignLeadToDay({ ...move, campaignId });
        if (!result.ok) failed++;
      }
      for (const leadId of overflow) {
        await unassignLeadFromDay(leadId);
      }
      return { moved: moves.length - failed, overflow: overflow.length, failed };
    },
    onSuccess: ({ moved, overflow, failed }) => {
      if (moved === 0 && overflow === 0) {
        toast.info("Nada para reorganizar — os dias já respeitam os limites seguros.");
      } else {
        toast.success(
          `${moved} lead(s) remanejados${overflow > 0 ? `, ${overflow} devolvidos a Disponíveis (não coube na semana)` : ""}${failed > 0 ? `, ${failed} falharam` : ""}.`,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["bot-plan", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["bot-queue", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-status", campaignId] });
    },
    onError: () => toast.error("Não foi possível reorganizar os leads."),
  });

  const clearMutation = useMutation({
    mutationFn: () => clearCampaignLeads(campaignId),
    onSuccess: () => {
      toast.success(
        "Leads da campanha liberados — vínculo removido e envios pendentes cancelados.",
      );
      queryClient.invalidateQueries({ queryKey: ["bot-plan", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["bot-queue", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-status", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Não foi possível limpar os leads."),
  });

  function onDragEnd(e: DragEndEvent) {
    const overId = e.over?.id as string | undefined;
    const leadId = e.active.id as string;
    if (!overId) return;

    if (overId === "pool") {
      unassignMutation.mutate(leadId);
      return;
    }

    const day = days.find((d) => d.dateKey === overId);
    if (day) assignMutation.mutate({ leadId, date: day.dateKey });
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
          Arraste da lista de disponíveis para um dia da semana
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs ml-auto"
          onClick={() => distributeMutation.mutate()}
          disabled={distributeMutation.isPending || pool.length === 0 || days.length === 0}
        >
          <Shuffle className="h-3.5 w-3.5" />
          {distributeMutation.isPending ? "Distribuindo…" : "Distribuir automaticamente"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => reorganizeMutation.mutate()}
          disabled={reorganizeMutation.isPending || plan.length === 0}
          title={`Rebalanceia os dias respeitando o limite seguro (máx. ${BAN_RISK_LIMIT}/dia)`}
        >
          <ListRestart className="h-3.5 w-3.5" />
          {reorganizeMutation.isPending ? "Reorganizando…" : "Reorganizar"}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs text-destructive hover:text-destructive"
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

          {days.map((day) => {
            const ids = leadIdsForDay(day.dateKey);
            const risk = riskForDay(ids.length, day.limit);
            const riskLabel =
              risk === "red"
                ? `Mais de ${BAN_RISK_LIMIT}/dia — risco alto de bloqueio do número`
                : ids.length > day.limit
                  ? `Acima do limite do dia (${day.limit}) — excedente não será enviado`
                  : `Perto do limite seguro (${BAN_RISK_LIMIT}/dia)`;
            return (
              <DroppableColumn
                key={day.dateKey}
                id={day.dateKey}
                title={day.dateKey === todayKey ? `Hoje · ${day.label}` : day.label}
                subtitle={`limite ${day.limit} · seguro ${Math.min(day.limit, BAN_RISK_LIMIT)}`}
                count={ids.length}
                risk={risk}
                riskLabel={riskLabel}
              >
                {ids.map((leadId) => {
                  const lead = leadsById.get(leadId);
                  if (!lead) return null;
                  return (
                    <DraggableChip
                      key={leadId}
                      lead={lead}
                      botDispatch={
                        day.dateKey === todayKey ? botDispatchByLeadId[leadId] : undefined
                      }
                    />
                  );
                })}
              </DroppableColumn>
            );
          })}
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
