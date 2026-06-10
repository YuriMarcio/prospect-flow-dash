import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Filter, MapPin, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useKanbanStore } from "@/store/kanban";
import { useFiltersStore } from "@/store/filters";
import { useNotificationsStore } from "@/store/notifications";
import { KanbanColumn } from "@/components/KanbanColumn";
import { LeadCard } from "@/components/LeadCard";
import { deduplicateLeads, getStatusForColumn, updateLead as updateLeadApi } from "@/lib/api";
import { useLeadsSync } from "@/hooks/use-leads-sync";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const DATE_OPTIONS = [
  { label: "Qualquer data", value: "all" },
  { label: "Hoje", value: "1" },
  { label: "Últimos 7 dias", value: "7" },
  { label: "Últimos 30 dias", value: "30" },
  { label: "Últimos 90 dias", value: "90" },
];

function isWithinDays(dateStr: string | undefined, days: number): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

export function KanbanPage() {
  const { columns, leads, moveLead, addColumn, updateLead } = useKanbanStore();
  const search = useFiltersStore((s) => s.search);
  const { scheduleFollowUp, cancelFollowUp } = useNotificationsStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filterCity, setFilterCity] = useState("all");
  const [filterDays, setFilterDays] = useState("all");
  const leadsQuery = useLeadsSync();
  const queryClient = useQueryClient();

  const dedupMutation = useMutation({
    mutationFn: deduplicateLeads,
    onSuccess: ({ removed }) => {
      if (removed === 0) {
        toast.info("Nenhum duplicado encontrado.");
      } else {
        toast.success(`${removed} lead${removed !== 1 ? "s" : ""} duplicado${removed !== 1 ? "s" : ""} removido${removed !== 1 ? "s" : ""}.`);
        queryClient.invalidateQueries({ queryKey: ["leads"] });
      }
    },
    onError: () => toast.error("Erro ao remover duplicados."),
  });

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, columnId }: { id: string; columnId: string }) =>
      updateLeadApi(id, { columnId, status: getStatusForColumn(columnId) }),
    onSuccess: (lead) => updateLead(lead.id, lead),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Unique cities for the filter dropdown
  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) {
      if (l.city && l.city !== "Sem cidade") set.add(l.city);
    }
    return [...set].sort();
  }, [leads]);

  const hasActiveFilters = filterCity !== "all" || filterDays !== "all";

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (search) {
        const q = search.toLowerCase();
        const match =
          l.companyName.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          l.instagram?.toLowerCase().includes(q) ||
          l.tags.some((t) => t.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (filterCity !== "all" && l.city !== filterCity) return false;
      if (filterDays !== "all" && !isWithinDays(l.createdAt, Number(filterDays))) return false;
      return true;
    });
  }, [leads, search, filterCity, filterDays]);

  const onDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const overId = e.over?.id as string | undefined;
    const id = e.active.id as string;
    if (!overId || !columns.some((c) => c.id === overId)) return;

    const lead = leads.find((l) => l.id === id);
    const destColumn = columns.find((c) => c.id === overId);
    const destTitle = (destColumn?.title ?? "").toLowerCase();

    moveLead(id, overId);
    updateLeadMutation.mutate({ id, columnId: overId });

    // Agenda follow-up ao entrar em prospecção
    if (destTitle.includes("prospec") && lead) {
      scheduleFollowUp(lead.id, lead.companyName, 48);
      toast.info(`Follow-up agendado para ${lead.companyName} em 48h`);
    }

    // Cancela follow-up ao fechar (ganho, perdido, negociação avançada)
    if (
      (destTitle.includes("ganho") ||
        destTitle.includes("perdido") ||
        destTitle.includes("fechad")) &&
      lead
    ) {
      cancelFollowUp(lead.id);
    }
  };
  const onDragCancel = () => setActiveId(null);

  const sorted = [...columns].sort((a, b) => a.order - b.order);
  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  return (
    <div className="flex flex-col h-screen overflow-hidden p-6 gap-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline Comercial</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Arraste leads entre as colunas para atualizar o pipeline.
          </p>
          {leadsQuery.isError && (
            <p className="text-sm text-destructive mt-1">
              Não foi possível carregar os leads da API.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={dedupMutation.isPending}>
                <Trash2 className="h-4 w-4" />
                {dedupMutation.isPending ? "Removendo…" : "Remover duplicados"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover leads duplicados?</AlertDialogTitle>
                <AlertDialogDescription>
                  Leads com mesmo Instagram, WhatsApp ou CNPJ serão removidos do banco. Essa ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => dedupMutation.mutate()}>
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            onClick={() => {
              const t = prompt("Nome da nova coluna");
              if (t) addColumn(t);
            }}
          >
            <Plus className="h-4 w-4" />
            Nova coluna
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          Filtrar por:
        </div>

        <Select value={filterCity} onValueChange={setFilterCity}>
          <SelectTrigger className="h-8 text-xs w-44 gap-1">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            <SelectValue placeholder="Cidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as cidades</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterDays} onValueChange={setFilterDays}>
          <SelectTrigger className="h-8 text-xs w-40">
            <SelectValue placeholder="Data de adição" />
          </SelectTrigger>
          <SelectContent>
            {DATE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <button
            onClick={() => {
              setFilterCity("all");
              setFilterDays("all");
            }}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-xs text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
          >
            <X className="h-3 w-3" />
            Limpar filtros
          </button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
          {hasActiveFilters ? " filtrado" : ""}
          {filtered.length !== 1 && hasActiveFilters ? "s" : ""}
        </span>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div
          className={`flex gap-3 overflow-x-auto pb-4 flex-1 min-h-0 ${activeId ? "cursor-grabbing" : ""}`}
        >
          {sorted.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              leads={filtered.filter((l) => l.columnId === col.id)}
            />
          ))}
          <button
            onClick={() => {
              const t = prompt("Nome da nova coluna");
              if (t) addColumn(t);
            }}
            className="w-64 shrink-0 h-28 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors self-start mt-0"
          >
            + Adicionar coluna
          </button>
        </div>

        <DragOverlay
          dropAnimation={{ duration: 180, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}
        >
          {activeLead ? (
            <div className="w-64">
              <LeadCard lead={activeLead} overlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
