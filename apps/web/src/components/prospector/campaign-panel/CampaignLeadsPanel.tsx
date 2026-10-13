import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Download, MoreHorizontal, Pencil, Plus, Search, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InstagramFormDialog } from "@/components/automacao/InstagramFormDialog";
import { IfoodFormDialog } from "@/components/automacao/IfoodFormDialog";
import { InstaDeliveryFormDialog } from "@/components/automacao/InstaDeliveryFormDialog";
import { listCampaigns as listCaptures } from "@/lib/api";
import {
  dispatchLeads,
  listCampaignLeads,
  removeLeadFromCampaign,
  type CampaignLead,
  type CampaignStatus,
  type DispatchResult,
  type ProspectingCampaign,
} from "@/lib/prospector";
import { formatShortDate, toIsoDate } from "@/lib/objectiveMeta";
import { useLeadModalStore } from "@/store/leadModal";
import { cn } from "@/lib/utils";
import { AddExistingLeadsDialog } from "./AddExistingLeadsDialog";
import { LeadFormDialog } from "./LeadFormDialog";
import { SOURCE_LABELS, dispatchBlockedReason, formatPhone, leadSituation } from "./leadDisplay";

type SituationFilter = "all" | "none" | "scheduled" | "sent" | "replied" | "failed";
type CaptureSource = "instagram" | "ifood" | "instadelivery";
type DispatchDay = "today" | "tomorrow" | "custom";

const FILTERS: { value: SituationFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "none", label: "Sem contato" },
  { value: "scheduled", label: "Na fila" },
  { value: "sent", label: "Contatados" },
  { value: "replied", label: "Responderam" },
  { value: "failed", label: "Falharam" },
];

function matchesFilter(lead: CampaignLead, filter: SituationFilter): boolean {
  const status = lead.bot.status;
  switch (filter) {
    case "all":
      return true;
    case "none":
      return status === "none" && lead.status === "novo";
    case "scheduled":
      return status === "queued" || status === "planned";
    case "sent":
      return status === "sent";
    case "replied":
      return status === "replied";
    case "failed":
      return status === "failed";
  }
}

/** "12 na fila de hoje · 8 para amanhã" — o resumo do envio em lote. */
function dispatchSummary(result: DispatchResult, tomorrowKey: string): string {
  const parts: string[] = [];
  if (result.queuedToday > 0) parts.push(`${result.queuedToday} na fila de hoje`);
  for (const planned of result.planned) {
    const when = planned.date === tomorrowKey ? "amanhã" : formatShortDate(planned.date).replace(".", "");
    parts.push(`${planned.count} para ${when}`);
  }
  return parts.join(" · ");
}

/**
 * Painel de leads de uma campanha (território): lista com seleção, cadastro manual, captura
 * direto na campanha e o botão que manda o bot falar SÓ com os leads escolhidos.
 */
export function CampaignLeadsPanel({
  campaign,
  status,
}: {
  campaign: ProspectingCampaign;
  status: CampaignStatus | undefined;
}) {
  const queryClient = useQueryClient();
  const openLead = useLeadModalStore((s) => s.open);

  const [filter, setFilter] = useState<SituationFilter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quickCount, setQuickCount] = useState("20");
  const [quickOpen, setQuickOpen] = useState(false);
  const [day, setDay] = useState<DispatchDay>("today");
  const [customDate, setCustomDate] = useState("");
  const [formState, setFormState] = useState<{ lead: CampaignLead | null } | null>(null);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [captureSource, setCaptureSource] = useState<CaptureSource | null>(null);
  const [removeTarget, setRemoveTarget] = useState<CampaignLead | null>(null);

  const leadsQuery = useQuery({
    queryKey: ["campaign-leads", campaign.id],
    queryFn: () => listCampaignLeads(campaign.id),
    refetchInterval: 8000,
  });
  const capturesQuery = useQuery({ queryKey: ["captures"], queryFn: listCaptures, refetchInterval: 10_000 });
  const anyCaptureRunning = (capturesQuery.data ?? []).some((capture) => capture.status === "running");

  const leads = useMemo(() => leadsQuery.data ?? [], [leadsQuery.data]);
  const counts = useMemo(() => {
    const result = Object.fromEntries(FILTERS.map(({ value }) => [value, 0])) as Record<SituationFilter, number>;
    for (const lead of leads) for (const { value } of FILTERS) if (matchesFilter(lead, value)) result[value]++;
    return result;
  }, [leads]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leads.filter(
      (lead) =>
        matchesFilter(lead, filter) &&
        (!query ||
          lead.companyName.toLowerCase().includes(query) ||
          lead.phone.includes(query) ||
          lead.category.toLowerCase().includes(query)),
    );
  }, [leads, filter, search]);

  const blockedReason = useMemo(() => new Map(leads.map((lead) => [lead.id, dispatchBlockedReason(lead)])), [leads]);
  const isSelectable = (lead: CampaignLead) => blockedReason.get(lead.id) === null;

  // A seleção só vale pra quem ainda pode ser enviado (a lista atualiza sozinha a cada 8s)
  const selectedIds = useMemo(() => [...selected].filter((id) => blockedReason.get(id) === null), [selected, blockedReason]);
  const selectableVisible = visible.filter(isSelectable);
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every((lead) => selected.has(lead.id));

  const tomorrowKey = toIsoDate(new Date(Date.now() + 86_400_000));
  const dispatchDate = day === "today" ? undefined : day === "tomorrow" ? tomorrowKey : customDate;
  const dispatchReady = day !== "custom" || (customDate !== "" && customDate >= tomorrowKey);

  const dispatchMutation = useMutation({
    mutationFn: (leadIds: string[]) => dispatchLeads(campaign.id, { leadIds, date: dispatchDate }),
    onSuccess: (result) => {
      const summary = dispatchSummary(result, tomorrowKey);
      const firstReasons = result.skipped.slice(0, 2).map((item) => item.reason).join(" ");
      const botPaused = status !== undefined && !status.is_active;

      if (!summary) {
        toast.error("Nenhum lead entrou na fila", { description: firstReasons || undefined });
      } else {
        toast.success(summary, {
          description:
            [
              result.skipped.length > 0 ? `${result.skipped.length} não entraram. ${firstReasons}` : "",
              botPaused && result.queuedToday > 0 ? "O bot está pausado — inicie a campanha para os envios saírem." : "",
            ]
              .filter(Boolean)
              .join(" ") || undefined,
        });
      }
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["campaign-leads", campaign.id] });
      queryClient.invalidateQueries({ queryKey: ["campaign-status", campaign.id] });
      queryClient.invalidateQueries({ queryKey: ["bot-queue", campaign.id] });
    },
    onError: (error) =>
      toast.error("Não foi possível enviar para o bot", {
        description: error instanceof Error ? error.message : undefined,
      }),
  });

  const removeMutation = useMutation({
    mutationFn: (lead: CampaignLead) => removeLeadFromCampaign(campaign.id, lead.id),
    onSuccess: (_void, lead) => {
      toast.success(`${lead.companyName} voltou para o Kanban geral`);
      setSelected((current) => {
        const next = new Set(current);
        next.delete(lead.id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["campaign-leads", campaign.id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error) =>
      toast.error("Não foi possível remover o lead", { description: error instanceof Error ? error.message : undefined }),
  });

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const lead of selectableVisible) {
        if (checked) next.add(lead.id);
        else next.delete(lead.id);
      }
      return next;
    });
  }

  function selectFirst() {
    const count = Math.max(1, Math.floor(Number(quickCount)) || 0);
    setSelected(new Set(selectableVisible.slice(0, count).map((lead) => lead.id)));
  }

  const hasLeads = leads.length > 0;
  const activeFilters = FILTERS.filter(({ value }) => value !== "failed" || counts.failed > 0);

  /** "Marcar os primeiros [20] [Marcar]" — inline no desktop, dentro de um popover no celular. */
  const quickSelectControls = (afterSelect?: () => void) => (
    <>
      Marcar os primeiros
      <Input
        type="number"
        inputMode="numeric"
        min={1}
        value={quickCount}
        onChange={(e) => setQuickCount(e.target.value)}
        className="h-10 w-20 px-2 text-center md:h-8 md:w-16 md:text-xs"
        aria-label="Quantos leads marcar"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 md:h-8"
        onClick={() => {
          selectFirst();
          afterSelect?.();
        }}
        disabled={selectableVisible.length === 0}
      >
        Marcar
      </Button>
    </>
  );

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card md:min-h-0 md:flex-1 md:overflow-hidden">
      {/* Topo: título, ações e filtros */}
      <div className="shrink-0 space-y-3 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Leads</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{leads.length}</span>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="max-md:h-10">
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Adicionar
                  <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCaptureSource("instagram")}>Capturar pelo Instagram</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCaptureSource("ifood")}>Capturar pelo iFood</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCaptureSource("instadelivery")}>Capturar pelo InstaDelivery</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setAddExistingOpen(true)}>Do Kanban geral…</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" className="max-md:h-10" onClick={() => setFormState({ lead: null })}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Novo lead
            </Button>
          </div>
        </div>

        {hasLeads && (
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-between">
            {/* Celular: os filtros ficam numa faixa de uma linha só, que rola pro lado */}
            <div className="no-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
              {activeFilters.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-medium transition-colors md:px-2.5 md:py-1",
                    filter === value
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:border-foreground/30",
                  )}
                >
                  {label} <span className="tabular-nums opacity-70">{counts[value]}</span>
                </button>
              ))}
            </div>
            <div className="relative md:w-auto">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar lead…" className="h-10 pl-8 md:h-8 md:w-44 md:text-xs" />
            </div>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
        {leadsQuery.isLoading ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">Carregando leads…</p>
        ) : !hasLeads ? (
          <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
            <Users className="h-8 w-8 text-muted-foreground/60" />
            <div>
              <p className="text-sm font-medium">Nenhum lead nesta campanha ainda</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cadastre um lead, capture da região ou traga leads do Kanban geral. O bot só fala com os que você escolher.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setFormState({ lead: null })}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Novo lead
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCaptureSource("instagram")}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Capturar da região
              </Button>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">Nenhum lead com esse filtro.</p>
        ) : (
          <>
            {/* Celular: o "marcar todos" do cabeçalho da tabela vira esta linha */}
            <label className="flex cursor-pointer items-center gap-3 border-b border-border bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground md:hidden">
              <Checkbox
                checked={allVisibleSelected}
                disabled={selectableVisible.length === 0}
                onCheckedChange={(checked) => toggleAllVisible(checked === true)}
              />
              Selecionar todos ({selectableVisible.length})
            </label>

            <div className="sticky top-0 z-10 hidden grid-cols-[1.25rem_minmax(0,2fr)_minmax(0,1fr)_6.5rem_9.5rem_1.75rem] items-center gap-x-3 border-b border-border bg-muted/70 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur md:grid">
              <Checkbox
                checked={allVisibleSelected}
                disabled={selectableVisible.length === 0}
                onCheckedChange={(checked) => toggleAllVisible(checked === true)}
                aria-label="Marcar todos os leads da lista"
              />
              <span>Lead</span>
              <span>WhatsApp</span>
              <span>Origem</span>
              <span>Situação</span>
              <span />
            </div>

            {visible.map((lead) => {
              const reason = blockedReason.get(lead.id) ?? null;
              const situation = leadSituation(lead);
              return (
                <div
                  key={lead.id}
                  onClick={() => openLead(lead.id)}
                  className={cn(
                    "grid cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)_2.25rem] items-center gap-x-3 gap-y-1 border-b border-border/60 px-4 py-3 transition-colors last:border-b-0 hover:bg-accent/40 active:bg-accent/40 md:py-2.5",
                    "md:grid-cols-[1.25rem_minmax(0,2fr)_minmax(0,1fr)_6.5rem_9.5rem_1.75rem]",
                    selected.has(lead.id) && reason === null && "bg-primary/5",
                  )}
                >
                  <span onClick={(e) => e.stopPropagation()} title={reason ?? undefined} className="-m-3 p-3 md:m-0 md:p-0">
                    <Checkbox
                      checked={selected.has(lead.id) && reason === null}
                      disabled={reason !== null}
                      onCheckedChange={(checked) => toggle(lead.id, checked === true)}
                      aria-label={`Selecionar ${lead.companyName}`}
                    />
                  </span>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{lead.companyName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {lead.category} · {lead.city}
                    </p>
                    {/* Celular: o resto das colunas vira uma linha de chips embaixo do nome */}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 md:hidden">
                      <span className="text-xs tabular-nums text-muted-foreground">{lead.phone ? formatPhone(lead.phone) : "Sem WhatsApp"}</span>
                      <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-medium", situation.className)}>{situation.label}</span>
                    </div>
                  </div>

                  <span className="hidden truncate text-sm tabular-nums md:block">
                    {lead.phone ? formatPhone(lead.phone) : <span className="text-muted-foreground">—</span>}
                  </span>
                  <span className="hidden md:block">
                    <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {SOURCE_LABELS[lead.source ?? ""] ?? "—"}
                    </span>
                  </span>
                  <span className="hidden md:block">
                    <span className={cn("inline-block max-w-full truncate rounded-md px-2 py-0.5 text-[11px] font-medium", situation.className)}>
                      {situation.label}
                    </span>
                  </span>

                  <span onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Ações de ${lead.companyName}`}
                          className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:h-7 md:w-7"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setFormState({ lead })}>
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={reason !== null || dispatchMutation.isPending}
                          onClick={() => dispatchMutation.mutate([lead.id])}
                        >
                          <Send className="mr-2 h-3.5 w-3.5" />
                          {reason ? `Enviar agora (${reason.toLowerCase()})` : "Enviar agora"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setRemoveTarget(lead)} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Remover da campanha
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Barra de envio: escolher quem e mandar. No celular fica colada no rodapé da tela enquanto a lista rola. */}
      {hasLeads && (
        <div className="sticky bottom-0 z-10 flex shrink-0 flex-col gap-2 rounded-b-xl border-t border-border bg-card px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_20px_-14px_rgb(0_0_0/0.6)] md:static md:flex-row md:flex-wrap md:items-center md:gap-x-4 md:gap-y-2 md:rounded-none md:bg-muted/30 md:pb-3 md:shadow-none">
          <div className="flex items-center justify-between gap-2 md:justify-start">
            <div className="flex items-center gap-2">
              <p className="text-sm">
                <span className="font-semibold tabular-nums">{selectedIds.length}</span>{" "}
                <span className="text-muted-foreground">selecionado{selectedIds.length === 1 ? "" : "s"}</span>
              </p>
              {selectedIds.length > 0 && (
                <button type="button" onClick={() => setSelected(new Set())} className="p-1 text-xs text-muted-foreground hover:text-foreground hover:underline">
                  Limpar
                </button>
              )}
            </div>

            {/* Celular: "marcar os primeiros N" fica atrás de um botão */}
            <Popover open={quickOpen} onOpenChange={setQuickOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-9 px-2 text-xs md:hidden" disabled={selectableVisible.length === 0}>
                  Marcar os primeiros…
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" className="flex w-auto items-center gap-2 text-sm text-muted-foreground">
                {quickSelectControls(() => setQuickOpen(false))}
              </PopoverContent>
            </Popover>
          </div>

          <div className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">{quickSelectControls()}</div>

          {/* Celular: os controles de envio só aparecem quando há alguém marcado (barra enxuta enquanto nada está selecionado) */}
          <div className={cn("flex-wrap items-center gap-2 md:ml-auto md:flex", selectedIds.length > 0 ? "flex" : "hidden")}>
            <Select value={day} onValueChange={(value) => setDay(value as DispatchDay)}>
              <SelectTrigger className="h-11 w-28 md:h-9 md:w-32" aria-label="Quando enviar">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="tomorrow">Amanhã</SelectItem>
                <SelectItem value="custom">Outro dia…</SelectItem>
              </SelectContent>
            </Select>
            {day === "custom" && (
              <Input type="date" min={tomorrowKey} value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="h-11 min-w-0 flex-1 md:h-9 md:w-40 md:flex-none" />
            )}
            <Button
              className="h-11 min-w-40 flex-1 md:h-9 md:flex-none"
              onClick={() => dispatchMutation.mutate(selectedIds)}
              disabled={selectedIds.length === 0 || !dispatchReady || dispatchMutation.isPending}
            >
              <Send className="mr-1.5 h-4 w-4" />
              {dispatchMutation.isPending ? "Enviando…" : `Enviar bot${selectedIds.length > 0 ? ` para ${selectedIds.length}` : ""}`}
            </Button>
          </div>
        </div>
      )}

      <LeadFormDialog
        open={formState !== null}
        onOpenChange={(open) => !open && setFormState(null)}
        lead={formState?.lead}
        campaignId={campaign.id}
        defaultCity={campaign.region ?? undefined}
      />

      <AddExistingLeadsDialog
        open={addExistingOpen}
        onOpenChange={setAddExistingOpen}
        campaignId={campaign.id}
        defaultCity={campaign.region ?? undefined}
      />

      <InstagramFormDialog
        open={captureSource === "instagram"}
        onOpenChange={(open) => !open && setCaptureSource(null)}
        anyRunning={anyCaptureRunning}
        campaignId={campaign.id}
        defaultCity={campaign.region ?? undefined}
      />
      <IfoodFormDialog
        open={captureSource === "ifood"}
        onOpenChange={(open) => !open && setCaptureSource(null)}
        anyRunning={anyCaptureRunning}
        campaignId={campaign.id}
      />
      <InstaDeliveryFormDialog
        open={captureSource === "instadelivery"}
        onOpenChange={(open) => !open && setCaptureSource(null)}
        anyRunning={anyCaptureRunning}
        campaignId={campaign.id}
      />

      <AlertDialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover "{removeTarget?.companyName}" da campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              O lead volta para o Kanban geral e os envios pendentes dele são cancelados. O histórico do que já foi enviado fica.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeTarget && removeMutation.mutate(removeTarget)}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
