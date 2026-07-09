import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startCampaignSession, stopCampaignSession, type CampaignStatus } from "@/lib/prospector";

const LATE_HOUR = 20; // depois das 20:00 mensagens podem incomodar

function defaultTime(offsetMinutes = 0): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function isAfterLateHour(date: Date): boolean {
  return date.getHours() >= LATE_HOUR;
}

/**
 * Card de sessão do board: iniciar/pausar o bot (modos "até terminar" e
 * "horário customizado"), previsão de término da fila e aviso quando a
 * execução passa das 20:00.
 */
export function SessionControlCard({
  campaignId,
  status,
}: {
  campaignId: string;
  status: CampaignStatus | undefined;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"until_done" | "custom">("until_done");
  const [startTime, setStartTime] = useState(defaultTime());
  const [endTime, setEndTime] = useState(defaultTime(120));

  const connected = Boolean(status?.connected);
  const isActive = Boolean(status?.is_active);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["campaign-status", campaignId] });
  }

  const startMutation = useMutation({
    mutationFn: () => {
      if (mode === "until_done") return startCampaignSession(campaignId, { mode });
      const toIso = (time: string) => {
        const [h, m] = time.split(":").map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d.toISOString();
      };
      return startCampaignSession(campaignId, {
        mode,
        startAt: toIso(startTime),
        endAt: toIso(endTime),
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Bot iniciado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const stopMutation = useMutation({
    mutationFn: () => stopCampaignSession(campaignId),
    onSuccess: () => {
      invalidate();
      toast.success("Bot pausado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // ── Previsão de término ──────────────────────────────────────────────────
  const intervalMs = status?.forecast?.intervalMs ?? 900_000;
  const queueRemaining = status?.forecast?.queueRemaining ?? 0;
  const pendingIfStarting = Math.max(0, (status?.todayLimit ?? 0) - (status?.todayCount ?? 0));

  let estimatedFinish: Date | null = null;
  let forecastLabel: string | null = null;
  if (queueRemaining > 0 && status?.forecast?.estimatedFinishAt) {
    estimatedFinish = new Date(status.forecast.estimatedFinishAt);
    forecastLabel = `termina ~${formatTime(estimatedFinish)}`;
  } else if (!isActive && pendingIfStarting > 0) {
    estimatedFinish = new Date(Date.now() + pendingIfStarting * intervalMs);
    forecastLabel = `se iniciar agora, ~${pendingIfStarting} envios até ~${formatTime(estimatedFinish)}`;
  }

  const customEndLate = mode === "custom" && Number(endTime.split(":")[0]) >= LATE_HOUR;
  const finishLate = Boolean(estimatedFinish && isAfterLateHour(estimatedFinish));
  const showLateWarning = finishLate || (!isActive && customEndLate);

  const sessionEndLabel = status?.sessionEndAt ? formatTime(new Date(status.sessionEndAt)) : null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span
          className={`flex items-center gap-1.5 text-sm font-medium ${
            isActive ? "text-green-500" : "text-muted-foreground"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${isActive ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`}
          />
          {isActive
            ? `Bot ativo${sessionEndLabel ? ` até ${sessionEndLabel}` : status?.sessionMode === "until_done" ? " (até terminar a fila)" : ""}`
            : connected
              ? "Bot pausado"
              : "WhatsApp desconectado"}
        </span>

        <div className="ml-auto">
          {isActive ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
            >
              <Pause className="mr-1 h-3.5 w-3.5" />
              {stopMutation.isPending ? "Pausando…" : "Pausar bot"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => startMutation.mutate()}
              disabled={!connected || startMutation.isPending}
              title={connected ? undefined : "Conecte o WhatsApp primeiro"}
            >
              <Play className="mr-1 h-3.5 w-3.5" />
              {startMutation.isPending ? "Iniciando…" : "Iniciar agora"}
            </Button>
          )}
        </div>
      </div>

      {!isActive && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("until_done")}
              className={
                mode === "until_done"
                  ? "text-left rounded-lg border border-primary bg-primary/10 p-3"
                  : "text-left rounded-lg border border-border p-3 hover:bg-accent/40"
              }
            >
              <p className="text-sm font-medium">Até terminar a fila de hoje</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Começa agora e pausa sozinho quando não houver mais nada pra enviar hoje.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode("custom")}
              className={
                mode === "custom"
                  ? "text-left rounded-lg border border-primary bg-primary/10 p-3"
                  : "text-left rounded-lg border border-border p-3 hover:bg-accent/40"
              }
            >
              <p className="text-sm font-medium">Horário customizado</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Define início e fim — pausa sozinho ao bater o horário final.
              </p>
            </button>
          </div>

          {mode === "custom" && (
            <div className="grid grid-cols-2 gap-2 max-w-xs">
              <div className="space-y-1">
                <Label className="text-xs">Começa às</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Termina às</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground border-t border-border pt-2.5">
        <span>
          Enviados hoje: <b className="text-foreground">{status?.todayCount ?? 0}</b> de{" "}
          {status?.todayLimit ?? 0}
        </span>
        <span>
          Na fila: <b className="text-foreground">{queueRemaining}</b>
        </span>
        {(status?.followupCount ?? 0) > 0 && (
          <span>Aguardando follow-up: {status?.followupCount}</span>
        )}
        {forecastLabel && <span className="text-foreground">{forecastLabel}</span>}
      </div>

      {showLateWarning && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            A previsão passa das <b>20:00</b> — mensagens tarde da noite podem incomodar os leads.
            Reduza a quantidade do dia ou ajuste a janela de envio na agenda abaixo.
          </p>
        </div>
      )}
    </div>
  );
}
