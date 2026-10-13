import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import {
  CalendarClock,
  Filter,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useKanbanStore } from "@/store/kanban";
import { useFiltersStore } from "@/store/filters";
import { useNotificationsStore } from "@/store/notifications";
import { KanbanColumn } from "@/components/KanbanColumn";
import { LeadCard, type BotDispatchInfo } from "@/components/LeadCard";
import { MobileKanbanBoard } from "@/components/MobileKanbanBoard";
import { BotStatusHeader } from "@/components/prospector/BotStatusHeader";
import { CampaignMetricsPanel } from "@/components/prospector/CampaignMetricsPanel";
import { ConnectQrDialog } from "@/components/prospector/ConnectQrDialog";
import { CampaignBoard } from "@/components/prospector/board/CampaignBoard";
import { deduplicateLeads, getStatusForColumn, updateLead as updateLeadApi } from "@/lib/api";
import { getCampaignStatus, listCampaigns, listDispatchQueue, type ProspectingCampaign } from "@/lib/prospector";
import { CampaignLeadsPanel } from "@/components/prospector/campaign-panel/CampaignLeadsPanel";
import { LeadFormDialog } from "@/components/prospector/campaign-panel/LeadFormDialog";
import { NewCampaignModal } from "@/components/prospector/NewCampaignModal";
import { useLeadsSync } from "@/hooks/use-leads-sync";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Lead } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const snapLeftToCursor: Modifier = ({ draggingNodeRect, transform }) => {
  if (!draggingNodeRect) return transform;

  const leftOffset = Math.min(draggingNodeRect.width * 0.75, 140);

  return {
    ...transform,
    x: transform.x - leftOffset,
    y: transform.y + 2,
  };
};

// ─── Constantes ──────────────────────────────────────────────────────────────

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

// ─── Página ──────────────────────────────────────────────────────────────────

type PendingMove = {
  leadId: string;
  columnId: string;
  lead: Lead;
  requiresMeeting: boolean;
};

export function KanbanPage() {
  const { columns, leads, moveLead, addColumn, updateLead } = useKanbanStore();
  const search = useFiltersStore((s) => s.search);
  const { scheduleFollowUp, cancelFollowUp } = useNotificationsStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filterCity, setFilterCity] = useState("all");
  const [filterDays, setFilterDays] = useState("all");
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [configBoard, setConfigBoard] = useState<{ open: boolean; tab?: string }>({ open: false });
  const [boardView, setBoardView] = useState<string>("geral");
  const [newCampaignOpen, setNewCampaignOpen] = useState(false);
  const [dedupConfirmOpen, setDedupConfirmOpen] = useState(false);
  const isMobile = useIsMobile();
  // Cadastro manual no Kanban geral: guarda a coluna onde o "+" foi clicado
  const [newLeadColumnId, setNewLeadColumnId] = useState<string | null>(null);

  // Estado do formulário de reunião
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<Lead["prospectingChannel"]>(undefined);

  const leadsQuery = useLeadsSync();
  const queryClient = useQueryClient();

  const campaignsQuery = useQuery({ queryKey: ["prospecting-campaigns"], queryFn: listCampaigns });
  const campaigns = campaignsQuery.data ?? [];
  const activeCampaign = campaigns.find((c) => c.id === boardView);

  // Se a campanha selecionada for excluída/desaparecer, volta pro Kanban geral.
  useEffect(() => {
    if (boardView !== "geral" && campaignsQuery.data && !activeCampaign) {
      setBoardView("geral");
    }
  }, [boardView, campaignsQuery.data, activeCampaign]);

  const campaignStatusQuery = useQuery({
    queryKey: ["campaign-status", activeCampaign?.id],
    queryFn: () => getCampaignStatus(activeCampaign!.id),
    enabled: Boolean(activeCampaign),
    refetchInterval: 5000,
  });

  const campaignQueueQuery = useQuery({
    queryKey: ["bot-queue", activeCampaign?.id],
    queryFn: () => listDispatchQueue(activeCampaign!.id),
    enabled: Boolean(activeCampaign),
    refetchInterval: 5000,
  });

  const botDispatchByLeadId = useMemo(() => {
    const map: Record<string, BotDispatchInfo> = {};
    for (const item of campaignQueueQuery.data ?? []) {
      if (item.status === "failed") continue;
      map[item.lead_id] = { status: item.status, sentAt: item.sent_at };
    }
    return map;
  }, [campaignQueueQuery.data]);

  const dedupMutation = useMutation({
    mutationFn: deduplicateLeads,
    onSuccess: ({ removed }) => {
      if (removed === 0) {
        toast.info("Nenhum duplicado encontrado.");
      } else {
        toast.success(
          `${removed} lead${removed !== 1 ? "s" : ""} duplicado${removed !== 1 ? "s" : ""} removido${removed !== 1 ? "s" : ""}.`,
        );
        queryClient.invalidateQueries({ queryKey: ["leads"] });
      }
    },
    onError: () => toast.error("Erro ao remover duplicados."),
  });

  const updateLeadMutation = useMutation({
    mutationFn: ({
      id,
      columnId,
      prospectingChannel,
      meetingAt,
      meetingNotes: notes,
    }: {
      id: string;
      columnId: string;
      prospectingChannel?: Lead["prospectingChannel"];
      meetingAt?: string;
      meetingNotes?: string;
    }) =>
      updateLeadApi(id, {
        columnId,
        status: getStatusForColumn(columnId),
        prospectingChannel,
        meetingAt,
        meetingNotes: notes,
      }),
    onSuccess: (lead) => updateLead(lead.id, lead),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: -0 } }));

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

  function openPendingDialog(move: PendingMove) {
    setPendingMove(move);
    setMeetingDate("");
    setMeetingTime("");
    setMeetingNotes("");
    setSelectedChannel(move.lead.prospectingChannel);
  }

  function closePendingDialog() {
    if (!pendingMove) return;
    const { leadId, columnId } = pendingMove;
    // Salva apenas a mudança de coluna sem canal/reunião
    updateLeadMutation.mutate({ id: leadId, columnId });
    setPendingMove(null);
  }

  function confirmMove() {
    if (!pendingMove) return;
    const { leadId, columnId } = pendingMove;

    let meetingAt: string | undefined;
    if (meetingDate) {
      const combined = meetingTime ? `${meetingDate}T${meetingTime}` : `${meetingDate}T09:00`;
      meetingAt = new Date(combined).toISOString();
    }

    updateLeadMutation.mutate({
      id: leadId,
      columnId,
      prospectingChannel: selectedChannel,
      meetingAt,
      meetingNotes: meetingNotes || undefined,
    });

    if (selectedChannel) updateLead(leadId, { prospectingChannel: selectedChannel });
    if (meetingAt) updateLead(leadId, { meetingAt, meetingNotes: meetingNotes || undefined });

    setPendingMove(null);
  }

  /** Move o lead de coluna e dispara os efeitos do pipeline (reunião, follow-up). Vale pro drag e pro botão "Mover". */
  const requestMove = (id: string, columnId: string) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;

    const destColumn = columns.find((c) => c.id === columnId);
    const destTitle = (destColumn?.title ?? "").toLowerCase();

    moveLead(id, columnId);

    const requiresMeeting = destTitle.includes("negocia") && !lead.meetingAt;
    openPendingDialog({ leadId: id, columnId, lead, requiresMeeting });

    if (destTitle.includes("prospec")) {
      scheduleFollowUp(lead.id, lead.companyName, 48);
      toast.info(`Follow-up agendado para ${lead.companyName} em 48h`);
    }

    if (
      destTitle.includes("ganho") ||
      destTitle.includes("perdido") ||
      destTitle.includes("fechad")
    ) {
      cancelFollowUp(lead.id);
    }
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const overId = e.over?.id as string | undefined;
    if (!overId || !columns.some((c) => c.id === overId)) return;
    requestMove(e.active.id as string, overId);
  };

  const onDragCancel = () => setActiveId(null);

  const sorted = [...columns].sort((a, b) => a.order - b.order);
  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  const canConfirmMeeting = !pendingMove?.requiresMeeting || Boolean(meetingDate);

  function addColumnPrompt() {
    const t = prompt("Nome da nova coluna");
    if (t) addColumn(t);
  }

  return (
    // No celular a página rola inteira (o <main> do layout); no desktop o board ocupa a altura e rola por dentro.
    <div className="flex flex-col gap-3 p-4 animate-fade-in md:h-full md:gap-4 md:overflow-hidden md:p-6">
      {/* Abas: Kanban geral (fixa) + uma por campanha de prospecção + Nova campanha */}
      <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        <div className="flex w-max shrink-0 items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
          <button
            onClick={() => setBoardView("geral")}
            className={`shrink-0 whitespace-nowrap px-3 py-2 rounded-md text-xs font-medium transition-colors md:py-1.5 ${
              boardView === "geral"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Kanban geral
          </button>
          {campaigns.map((campaign) => (
            <button
              key={campaign.id}
              onClick={() => setBoardView(campaign.id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-md text-xs font-medium transition-colors md:py-1.5 ${
                boardView === campaign.id
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  campaign.is_active ? "bg-green-500 animate-pulse" : "bg-muted-foreground/50"
                }`}
              />
              {campaign.name}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="shrink-0 max-md:h-10 max-md:w-10 max-md:px-0"
          onClick={() => setNewCampaignOpen(true)}
          aria-label="Nova campanha"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="max-md:hidden">Nova campanha</span>
        </Button>
      </div>

      {activeCampaign ? (
        <div className="flex flex-col gap-3 md:min-h-0 md:flex-1 md:gap-4">
          <BotStatusHeader
            campaignId={activeCampaign.id}
            campaignName={activeCampaign.name}
            region={activeCampaign.region}
            status={campaignStatusQuery.data}
            onConfigure={(tab) => setConfigBoard({ open: true, tab })}
            onConnect={() => setConnectOpen(true)}
            onDeleted={() => setBoardView("geral")}
          />
          <CampaignMetricsPanel campaignId={activeCampaign.id} status={campaignStatusQuery.data} />
          <CampaignLeadsPanel campaign={activeCampaign} status={campaignStatusQuery.data} />

          <ConnectQrDialog open={connectOpen} onOpenChange={setConnectOpen} />
          <CampaignBoard
            campaignId={activeCampaign.id}
            open={configBoard.open}
            onOpenChange={(open) => setConfigBoard((prev) => ({ ...prev, open }))}
            initialTab={configBoard.tab}
          />
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight md:text-2xl">
                <span className="md:hidden">Pipeline</span>
                <span className="hidden md:inline">Pipeline comercial</span>
              </h1>
              <p className="hidden text-sm text-muted-foreground md:block">
                Arraste leads entre colunas · dados compartilhados entre todos
              </p>
              {leadsQuery.isError && (
                <p className="mt-1 text-xs text-destructive md:text-sm">
                  Não foi possível carregar os leads da API.
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="hidden md:inline-flex"
                disabled={dedupMutation.isPending}
                onClick={() => setDedupConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                {dedupMutation.isPending ? "Removendo…" : "Remover duplicados"}
              </Button>

              <Button variant="outline" className="hidden md:inline-flex" onClick={addColumnPrompt}>
                <Plus className="h-4 w-4" />
                Nova coluna
              </Button>

              <Button className="max-md:h-10" onClick={() => setNewLeadColumnId(sorted[0]?.id ?? "col-1")}>
                <Plus className="h-4 w-4" />
                Novo lead
              </Button>

              {/* Celular: as ações secundárias ficam num menu pra não ocupar a tela */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-10 w-10 md:hidden" aria-label="Mais ações">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" collisionPadding={12}>
                  <DropdownMenuItem onClick={addColumnPrompt}>
                    <Plus />
                    Nova coluna
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={dedupMutation.isPending}
                    onClick={() => setDedupConfirmOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 />
                    Remover duplicados
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-2 md:flex-wrap">
            <div className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
              <Filter className="h-3.5 w-3.5" />
              Filtrar por:
            </div>

            <Select value={filterCity} onValueChange={setFilterCity}>
              <SelectTrigger className="h-10 min-w-0 flex-1 gap-1 text-xs md:h-8 md:w-44 md:flex-none">
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
              <SelectTrigger className="h-10 min-w-0 flex-1 text-xs md:h-8 md:w-40 md:flex-none">
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
                aria-label="Limpar filtros"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-1 rounded-md border border-destructive/30 text-xs text-destructive transition-colors hover:bg-destructive/10 md:h-8 md:w-auto md:px-2.5"
              >
                <X className="h-3.5 w-3.5 md:h-3 md:w-3" />
                <span className="hidden md:inline">Limpar filtros</span>
              </button>
            )}

            <span className="ml-auto hidden text-xs text-muted-foreground md:inline">
              {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
              {hasActiveFilters ? " filtrado" : ""}
              {filtered.length !== 1 && hasActiveFilters ? "s" : ""}
            </span>
          </div>

          {/* Board: só no cliente — o servidor não sabe se a tela é de celular e mostraria o layout errado por um instante */}
          <ClientOnly fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40 md:flex-1" />}>
            {isMobile ? (
              <MobileKanbanBoard
                columns={sorted}
                leads={filtered}
                botDispatchByLeadId={botDispatchByLeadId}
                onAddLead={setNewLeadColumnId}
                onMoveLead={requestMove}
              />
            ) : (
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
                      botDispatchByLeadId={botDispatchByLeadId}
                      onAddLead={setNewLeadColumnId}
                    />
                  ))}
                  <button
                    onClick={addColumnPrompt}
                    className="w-64 shrink-0 h-28 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors self-start mt-0"
                  >
                    + Adicionar coluna
                  </button>
                </div>

                <DragOverlay
                  modifiers={[snapLeftToCursor]}
                  dropAnimation={{ duration: 150, easing: "ease-out" }}
                >
                  {activeLead ? (
                    <div className="w-64 opacity-95 shadow-2xl ring-2 ring-primary/30 rounded-lg">
                      <LeadCard lead={activeLead} overlay />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </ClientOnly>
        </>
      )}

      <AlertDialog open={dedupConfirmOpen} onOpenChange={setDedupConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover leads duplicados?</AlertDialogTitle>
            <AlertDialogDescription>
              Leads com mesmo Instagram, WhatsApp ou CNPJ serão removidos do banco. Essa ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => dedupMutation.mutate()}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cadastro manual de lead no Kanban geral (o "+" da coluna ou o botão do topo) */}
      <LeadFormDialog
        open={newLeadColumnId !== null}
        onOpenChange={(open) => !open && setNewLeadColumnId(null)}
        columnId={newLeadColumnId ?? undefined}
      />

      {/* Dialog: canal + reunião */}
      <Dialog
        open={Boolean(pendingMove)}
        onOpenChange={(open) => {
          if (!open) closePendingDialog();
        }}
      >
        <DialogContent mobileSheet className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {pendingMove?.requiresMeeting ? "Agendar reunião" : "Canal de prospecção"}
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground -mt-1">
            {pendingMove?.requiresMeeting ? (
              <>
                Para entrar em negociação, agende uma reunião com{" "}
                <span className="font-medium text-foreground">{pendingMove?.lead.companyName}</span>
                .
              </>
            ) : (
              <>
                Via qual canal você contatou{" "}
                <span className="font-medium text-foreground">{pendingMove?.lead.companyName}</span>
                ?
              </>
            )}
          </p>

          {/* Canal de prospecção */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Canal
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["whatsapp", "instagram", "email"] as const).map((ch) => {
                const icon =
                  ch === "whatsapp" ? (
                    <MessageCircle className="h-5 w-5 text-green-500" />
                  ) : ch === "instagram" ? (
                    <Instagram className="h-5 w-5 text-pink-500" />
                  ) : (
                    <Mail className="h-5 w-5 text-blue-500" />
                  );
                const label =
                  ch === "whatsapp" ? "WhatsApp" : ch === "instagram" ? "Instagram" : "E-mail";
                const colorClass =
                  ch === "whatsapp"
                    ? "hover:border-green-500 hover:bg-green-500/10 data-[sel=true]:border-green-500 data-[sel=true]:bg-green-500/15"
                    : ch === "instagram"
                      ? "hover:border-pink-500 hover:bg-pink-500/10 data-[sel=true]:border-pink-500 data-[sel=true]:bg-pink-500/15"
                      : "hover:border-blue-500 hover:bg-blue-500/10 data-[sel=true]:border-blue-500 data-[sel=true]:bg-blue-500/15";
                return (
                  <button
                    key={ch}
                    data-sel={selectedChannel === ch}
                    onClick={() => setSelectedChannel(selectedChannel === ch ? undefined : ch)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 transition-colors ${colorClass}`}
                  >
                    {icon}
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reunião (só para negociação) */}
          {pendingMove?.requiresMeeting && (
            <div className="space-y-3 pt-1 border-t border-border">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary shrink-0" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Reunião
                </p>
                <span className="ml-auto text-[10px] text-destructive font-medium">
                  Obrigatório
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="meet-date" className="text-xs">
                    Data
                  </Label>
                  <Input
                    id="meet-date"
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="h-10 text-base md:h-8 md:text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="meet-time" className="text-xs">
                    Hora
                  </Label>
                  <Input
                    id="meet-time"
                    type="time"
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                    className="h-10 text-base md:h-8 md:text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="meet-notes" className="text-xs">
                  Observações (opcional)
                </Label>
                <Input
                  id="meet-notes"
                  placeholder="ex: Apresentar proposta comercial"
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  className="h-10 text-base md:h-8 md:text-xs"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={closePendingDialog}
              className="flex-1 text-sm text-muted-foreground hover:text-foreground transition-colors text-center py-3 md:text-xs md:py-2"
            >
              Pular
            </button>
            <Button
              onClick={confirmMove}
              disabled={!canConfirmMeeting}
              size="sm"
              className="flex-1 max-md:h-11 max-md:text-sm"
            >
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <NewCampaignModal
        open={newCampaignOpen}
        onOpenChange={setNewCampaignOpen}
        onCreated={(campaign) => setBoardView(campaign.id)}
      />
    </div>
  );
}
