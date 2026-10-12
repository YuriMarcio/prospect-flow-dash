export interface ObjectiveStatsValues {
  total: number;
  inProgress: number;
  milestonesDone: number;
  milestonesTotal: number;
  milestoneAverage: number;
}

export function ObjectiveStats({ stats }: { stats: ObjectiveStatsValues }) {
  const cards = [
    { label: "Objetivos no quadro", value: String(stats.total), caption: "Distribuídos entre as áreas" },
    { label: "Em andamento", value: String(stats.inProgress), caption: "Em execução agora" },
    {
      label: "Marcos concluídos",
      value: `${stats.milestonesDone}/${stats.milestonesTotal}`,
      caption: "Milestones 100% entregues",
    },
    { label: "Avanço dos marcos", value: `${stats.milestoneAverage}%`, caption: "Média de conclusão" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-2xl font-bold tracking-tight">{card.value}</span>
            <span className="text-[11px] text-muted-foreground">{card.caption}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
