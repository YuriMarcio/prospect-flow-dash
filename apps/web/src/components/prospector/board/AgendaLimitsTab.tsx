import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCampaign, type ProspectingCampaign, type Schedule } from "@/lib/prospector";
import { AgendaTab } from "../AgendaTab";
import { FiltersTab } from "../FiltersTab";

/**
 * Aba "Agenda & limites" do board: dias da semana com limite de leads/dia,
 * janela de horário de envio e filtros de cidade/segmento — tudo num lugar só.
 */
export function AgendaLimitsTab({ campaign }: { campaign: ProspectingCampaign }) {
  const queryClient = useQueryClient();
  const [schedule, setSchedule] = useState<Schedule>(campaign.schedule);
  const [filters, setFilters] = useState(campaign.filters);
  const [windowStart, setWindowStart] = useState(campaign.window_start);
  const [windowEnd, setWindowEnd] = useState(campaign.window_end);

  useEffect(() => {
    setSchedule(campaign.schedule);
    setFilters(campaign.filters);
    setWindowStart(campaign.window_start);
    setWindowEnd(campaign.window_end);
  }, [campaign]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateCampaign(campaign.id, {
        schedule,
        filters,
        window_start: windowStart,
        window_end: windowEnd,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", campaign.id] });
      queryClient.invalidateQueries({ queryKey: ["campaign-status", campaign.id] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Agenda salva.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const totalWeek = Object.values(schedule).reduce(
    (sum, day) => sum + (day.enabled ? day.limit : 0),
    0,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <AgendaTab schedule={schedule} onChange={setSchedule} />
        <p className="text-[11px] text-muted-foreground">
          Total planejado: <b>{totalWeek} leads/semana</b>. Números novos passam por aquecimento
          automático (5 → 15 → 25/dia nas duas primeiras semanas), mesmo com limites maiores.
        </p>

        <div className="flex items-end gap-3 border-t border-border pt-3">
          <div className="space-y-1">
            <Label className="text-xs">Enviar a partir de</Label>
            <Input
              type="time"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
              className="h-8 w-28 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">até</Label>
            <Input
              type="time"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
              className="h-8 w-28 text-xs"
            />
          </div>
          <p className="pb-1.5 text-[11px] text-muted-foreground">
            Fora dessa janela nada é enviado — inclusive follow-ups, que aguardam a próxima janela.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <FiltersTab filters={filters} onChange={setFilters} />
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Salvando…" : "Salvar agenda & filtros"}
        </Button>
      </div>
    </div>
  );
}
