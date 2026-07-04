import type { CampaignStatus } from "@/lib/prospector";

export function BotMetricsStrip({ status }: { status: CampaignStatus | undefined }) {
  const responseRate =
    status && status.todayCount > 0
      ? Math.round(((status.todayCount - status.queueSize) / status.todayCount) * 100)
      : 0;

  const filterChips = [...(status?.filters.cities ?? []), ...(status?.filters.segments ?? [])];

  const cards = [
    {
      label: "Hoje",
      value: status?.todayCount ?? 0,
      sub: `de ${status?.todayLimit ?? 0} disparos`,
    },
    {
      label: "Aguardando",
      value: status?.queueSize ?? 0,
      sub: "leads na fila",
    },
    {
      label: "Responderam",
      value: `${responseRate}%`,
      sub: "de retorno",
    },
  ];

  return (
    <div
      className="grid gap-2.5"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
    >
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{card.label}</p>
          <p className="text-xl font-semibold tabular-nums mt-1">{card.value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{card.sub}</p>
        </div>
      ))}

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">Filtros ativos</p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {filterChips.length === 0 ? (
            <span className="text-[11px] text-muted-foreground">Nenhum filtro</span>
          ) : (
            filterChips.map((chip) => (
              <span
                key={chip}
                className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
              >
                {chip}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
