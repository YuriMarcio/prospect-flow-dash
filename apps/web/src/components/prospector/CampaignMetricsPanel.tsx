import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Flame } from "lucide-react";
import { getCampaignMetrics, type CampaignStatus } from "@/lib/prospector";
import { INTENT_LABELS, type Intent } from "@/lib/flows";

const LATE_HOUR = 20;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** "45min", "2h", "1d" — legível, sem falsa precisão. */
function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "<1min";
  if (minutes < 60) return `${minutes}min`;
  const hours = ms / 3_600_000;
  if (hours < 48) return `${Math.round(hours * 10) / 10}h`.replace(".", ",");
  return `${Math.round(hours / 24)}d`;
}

function StatTile({
  label,
  value,
  valueSuffix,
  sub,
  accent,
  children,
}: {
  label: string;
  value: React.ReactNode;
  valueSuffix?: string;
  sub: React.ReactNode;
  accent?: "amber";
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">
        {value}
        {valueSuffix && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">{valueSuffix}</span>
        )}
      </p>
      {children}
      <p
        className={`mt-1 flex items-center gap-1 text-[11px] ${
          accent === "amber" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
        }`}
      >
        {accent === "amber" && <AlertTriangle className="h-3 w-3 shrink-0" />}
        {sub}
      </p>
    </div>
  );
}

/**
 * Painel de métricas da campanha: progresso do dia com previsão de término,
 * taxa de resposta real (acumulada), tempo médio de resposta e oportunidades
 * quentes, mais a quebra de intenções detectadas pela IA.
 */
export function CampaignMetricsPanel({
  campaignId,
  status,
}: {
  campaignId: string;
  status: CampaignStatus | undefined;
}) {
  const metricsQuery = useQuery({
    queryKey: ["campaign-metrics", campaignId],
    queryFn: () => getCampaignMetrics(campaignId),
    refetchInterval: 15_000,
  });
  const metrics = metricsQuery.data;

  // ── Tile 1: progresso de hoje + previsão ──────────────────────────────────
  const todayCount = status?.todayCount ?? 0;
  const todayLimit = status?.todayLimit ?? 0;
  const queueRemaining = status?.forecast?.queueRemaining ?? 0;
  const finishAt = status?.forecast?.estimatedFinishAt ?? null;
  const finishLate = finishAt ? new Date(finishAt).getHours() >= LATE_HOUR : false;
  const progress = todayLimit > 0 ? Math.min(100, Math.round((todayCount / todayLimit) * 100)) : 0;

  const todaySub =
    queueRemaining > 0
      ? `${queueRemaining} na fila · termina ~${finishAt ? formatTime(finishAt) : "—"}`
      : todayCount > 0
        ? "fila de hoje concluída"
        : "nada na fila hoje";

  // ── Demais tiles ──────────────────────────────────────────────────────────
  const total = metrics?.total;
  const intentEntries = Object.entries(metrics?.intents ?? {}).sort((a, b) => b[1] - a[1]);
  const filterChips = [...(status?.filters.cities ?? []), ...(status?.filters.segments ?? [])];

  return (
    <div className="space-y-2.5">
      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
      >
        <StatTile
          label="Disparos de hoje"
          value={todayCount}
          valueSuffix={`de ${todayLimit}`}
          sub={todaySub}
          accent={finishLate && queueRemaining > 0 ? "amber" : undefined}
        >
          <div
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-primary/15"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full rounded-full ${finishLate && queueRemaining > 0 ? "bg-amber-500" : "bg-primary"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </StatTile>

        <StatTile
          label="Taxa de resposta"
          value={total ? `${total.responseRate}%` : "—"}
          sub={
            total && total.sent > 0
              ? `${total.replied} resposta${total.replied === 1 ? "" : "s"} · ${total.sent} enviados (acumulado)`
              : "nenhum envio ainda"
          }
        />

        <StatTile
          label="Tempo médio de resposta"
          value={metrics?.avgResponseMs != null ? `~${formatDuration(metrics.avgResponseMs)}` : "—"}
          sub="entre o envio e a resposta do lead"
        />

        <StatTile
          label="Oportunidades quentes"
          value={
            <span className="inline-flex items-center gap-1.5">
              {metrics?.hotLeads ?? "—"}
              {(metrics?.hotLeads ?? 0) > 0 && <Flame className="h-4 w-4 text-primary" />}
            </span>
          }
          sub={
            total
              ? `prontidão alta (IA) · ${total.inNegotiation} em negociação · ${total.followupsPending} follow-ups`
              : "prontidão alta detectada pela IA"
          }
        />
      </div>

      {(intentEntries.length > 0 || (total?.failed ?? 0) > 0 || filterChips.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border bg-card px-4 py-2.5">
          {intentEntries.length > 0 && (
            <>
              <span className="text-[11px] text-muted-foreground">Intenções:</span>
              {intentEntries.map(([intent, count]) => (
                <span
                  key={intent}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground"
                >
                  {INTENT_LABELS[intent as Intent] ?? intent}{" "}
                  <b className="tabular-nums">{count}</b>
                </span>
              ))}
            </>
          )}

          {(total?.failed ?? 0) > 0 && (
            <span className="text-[11px] text-muted-foreground">
              Falhas de envio: <b className="text-foreground tabular-nums">{total!.failed}</b>
            </span>
          )}

          {filterChips.length > 0 && (
            <span className="ml-auto flex flex-wrap items-center gap-1">
              <span className="text-[11px] text-muted-foreground">Filtros:</span>
              {filterChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {chip}
                </span>
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
