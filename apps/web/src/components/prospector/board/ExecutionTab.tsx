import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getCampaignStatus,
  updateCampaign,
  type ProspectingCampaign,
  type Schedule,
} from "@/lib/prospector";
import { SessionControlCard } from "./SessionControlCard";
import { AgendaCard } from "./AgendaCard";
import { CityCombobox } from "./CityCombobox";

const SEGMENT_SUGGESTIONS = ["Hamburgueria", "Pizzaria", "Açaí", "Cafeteria"];

function SegmentChips({
  values,
  onAdd,
  onRemove,
}: {
  values: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function commit() {
    if (draft.trim()) onAdd(draft.trim());
    setDraft("");
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span
          key={value}
          className="flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs text-primary"
        >
          <Wrench className="h-3 w-3" />
          {value}
          <button type="button" onClick={() => onRemove(value)} className="ml-0.5 hover:opacity-70">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          placeholder="Ex: Pizzaria"
          className="rounded-full border border-border bg-card px-2.5 py-1 text-xs outline-none w-32"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Adicionar
        </button>
      )}
    </div>
  );
}

/**
 * Aba "Execução & agenda" do board: sessão (iniciar/pausar + previsão),
 * agenda semanal com avisos e filtros de cidade/segmento.
 */
export function ExecutionTab({ campaign }: { campaign: ProspectingCampaign }) {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["campaign-status", campaign.id],
    queryFn: () => getCampaignStatus(campaign.id),
    refetchInterval: 5000,
  });

  const [schedule, setSchedule] = useState<Schedule>(campaign.schedule);
  const [filters, setFilters] = useState(campaign.filters);
  const [windowStart, setWindowStart] = useState(campaign.window_start);
  const [windowEnd, setWindowEnd] = useState(campaign.window_end);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (dirty) return;
    setSchedule(campaign.schedule);
    setFilters(campaign.filters);
    setWindowStart(campaign.window_start);
    setWindowEnd(campaign.window_end);
  }, [campaign, dirty]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateCampaign(campaign.id, {
        schedule,
        filters,
        window_start: windowStart,
        window_end: windowEnd,
      }),
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["campaign", campaign.id] });
      queryClient.invalidateQueries({ queryKey: ["campaign-status", campaign.id] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Agenda e filtros salvos.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const intervalMs = statusQuery.data?.forecast?.intervalMs ?? 900_000;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <SessionControlCard campaignId={campaign.id} status={statusQuery.data} />

      <AgendaCard
        schedule={schedule}
        onScheduleChange={(next) => {
          setSchedule(next);
          setDirty(true);
        }}
        windowStart={windowStart}
        windowEnd={windowEnd}
        onWindowChange={(start, end) => {
          setWindowStart(start);
          setWindowEnd(end);
          setDirty(true);
        }}
        intervalMs={intervalMs}
      />

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Cidades</p>
          <CityCombobox
            values={filters.cities}
            onChange={(cities) => {
              setFilters({ ...filters, cities });
              setDirty(true);
            }}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Segmentos</p>
          <SegmentChips
            values={filters.segments}
            onAdd={(value) => {
              setFilters({ ...filters, segments: [...filters.segments, value] });
              setDirty(true);
            }}
            onRemove={(value) => {
              setFilters({ ...filters, segments: filters.segments.filter((s) => s !== value) });
              setDirty(true);
            }}
          />
          {filters.segments.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              Sugestões: {SEGMENT_SUGGESTIONS.join(", ")}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
        >
          {saveMutation.isPending ? "Salvando…" : dirty ? "Salvar agenda & filtros" : "Salvo"}
        </Button>
      </div>
    </div>
  );
}
