import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, CheckCircle2, Loader2, Pause, Square, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { stopCampaign } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Capture } from "@/types";
import { elapsedMs, estimateRemainingMinutes, formatElapsedHMS } from "./estimate";

export function RunningCampaignPanel({ campaign }: { campaign: Capture }) {
  const queryClient = useQueryClient();
  const [paramsOpen, setParamsOpen] = useState(false);
  const isRunning = campaign.status === "running";

  const stopMutation = useMutation({
    mutationFn: stopCampaign,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const pct = campaign.quantity > 0
    ? Math.min(100, Math.round((campaign.processed / campaign.quantity) * 100))
    : 0;
  const taxaSucesso = campaign.processed > 0 ? Math.round((campaign.found / campaign.processed) * 100) : 0;
  const elapsed = elapsedMs(campaign);
  const remainingMin = estimateRemainingMinutes(campaign);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      <div className="p-4 border-b border-border space-y-1">
        <h2 className="text-sm font-semibold">Execuções em andamento</h2>
        <p className="text-xs text-muted-foreground">Acompanhe suas capturas em tempo real.</p>
      </div>

      <div className="p-4 space-y-4 flex-1">
        <div className="flex items-center gap-3">
          {isRunning ? (
            <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
          ) : campaign.status === "done" ? (
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {campaign.category} — {campaign.city}
            </p>
            <p className="text-[11px] text-muted-foreground">Iniciado em {campaign.startedAt}</p>
          </div>
          {isRunning && (
            <span className="flex items-center gap-1 text-[10px] text-success font-mono shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              AO VIVO
            </span>
          )}

          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-2 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button variant="outline" size="sm" disabled>
                      <Pause className="h-3.5 w-3.5" />
                      Pausar
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Em breve</TooltipContent>
              </Tooltip>

              {isRunning && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                  onClick={() => stopMutation.mutate(campaign.id)}
                  disabled={stopMutation.isPending}
                >
                  <Square className="h-3 w-3 fill-current" />
                  Parar
                </Button>
              )}
            </div>
          </TooltipProvider>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground tabular-nums">
              {campaign.processed} / {campaign.quantity}
            </span>
            <span className="font-medium tabular-nums">{pct}%</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <Stat label="Taxa de sucesso" value={`${taxaSucesso}%`} cls="text-success" />
          <Stat label="Leads salvos" value={campaign.found} cls="text-info" />
          <Stat label="Falhas" value={campaign.errors} cls="text-destructive" />
          <Stat label="Tempo decorrido" value={elapsed !== null ? formatElapsedHMS(elapsed) : "—"} />
          <Stat label="Tempo restante" value={remainingMin !== null ? `${remainingMin} min` : "—"} />
        </div>
      </div>

      <Collapsible open={paramsOpen} onOpenChange={setParamsOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between px-4 py-2.5 border-t border-border text-xs font-medium text-muted-foreground hover:bg-accent/40 transition">
            Parâmetros utilizados
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", paramsOpen && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
            <div>
              <p className="text-muted-foreground">Categoria</p>
              <p className="font-medium">{campaign.category}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cidade</p>
              <p className="font-medium">{campaign.city}{campaign.neighborhood ? ` • ${campaign.neighborhood}` : ""}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Quantidade</p>
              <p className="font-medium">{campaign.quantity} leads</p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: string | number; cls?: string }) {
  return (
    <div>
      <p className={cn("text-sm font-semibold tabular-nums", cls)}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
