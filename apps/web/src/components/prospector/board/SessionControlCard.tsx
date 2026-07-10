import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startCampaignSession, stopCampaignSession, type CampaignStatus } from "@/lib/prospector";

const LATE_HOUR = 20; // depois das 20:00 mensagens podem incomodar

function formatTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Card de sessão do board: status ao vivo, iniciar/pausar e previsão de
 * término. Iniciar roda "até terminar a fila de hoje" — os horários vêm da
 * janela configurada na agenda, sem modo customizado.
 */
export function SessionControlCard({
  campaignId,
  status,
  windowStart,
  windowEnd,
}: {
  campaignId: string;
  status: CampaignStatus | undefined;
  windowStart: string;
  windowEnd: string;
}) {
  const queryClient = useQueryClient();

  const connected = Boolean(status?.connected);
  const isActive = Boolean(status?.is_active);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["campaign-status", campaignId] });
  }

  const startMutation = useMutation({
    mutationFn: () => startCampaignSession(campaignId, { mode: "until_done" }),
    onSuccess: () => {
      invalidate();
      toast.success("Bot iniciado — roda até terminar a fila de hoje.");
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
    forecastLabel = `fila termina ~${formatTime(estimatedFinish)}`;
  } else if (!isActive && pendingIfStarting > 0) {
    estimatedFinish = new Date(Date.now() + pendingIfStarting * intervalMs);
    forecastLabel = `se iniciar agora, ~${pendingIfStarting} envios até ~${formatTime(estimatedFinish)}`;
  }

  const finishLate = Boolean(estimatedFinish && estimatedFinish.getHours() >= LATE_HOUR);

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
            ? `Bot ativo${sessionEndLabel ? ` até ${sessionEndLabel}` : " — roda até terminar a fila de hoje"}`
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

      <p className="text-[11px] text-muted-foreground">
        Os envios acontecem dentro da janela da agenda ({windowStart}–{windowEnd}) e o bot pausa
        sozinho quando a fila de hoje termina.
      </p>

      {finishLate && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            A previsão passa das <b>20:00</b> — mensagens tarde da noite podem incomodar os leads.
            Reduza a quantidade do dia ou ajuste a janela na agenda abaixo.
          </p>
        </div>
      )}
    </div>
  );
}
