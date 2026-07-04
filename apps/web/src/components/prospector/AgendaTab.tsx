import type { DaySchedule, Schedule } from "@/lib/prospector";

const DAYS: { key: keyof Schedule; label: string }[] = [
  { key: "seg", label: "Seg" },
  { key: "ter", label: "Ter" },
  { key: "qua", label: "Qua" },
  { key: "qui", label: "Qui" },
  { key: "sex", label: "Sex" },
  { key: "sab", label: "Sáb" },
  { key: "dom", label: "Dom" },
];

export function AgendaTab({
  schedule,
  onChange,
}: {
  schedule: Schedule;
  onChange: (next: Schedule) => void;
}) {
  function toggleDay(key: keyof Schedule) {
    const day = schedule[key];
    onChange({ ...schedule, [key]: { ...day, enabled: !day.enabled } });
  }

  function setLimit(key: keyof Schedule, limit: number) {
    onChange({ ...schedule, [key]: { ...schedule[key], limit } });
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">Disparos por dia</p>
        <p className="text-[11px] text-muted-foreground">clique no dia para ativar</p>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {DAYS.map(({ key, label }) => {
          const day: DaySchedule = schedule[key];
          return (
            <div
              key={key}
              onClick={() => toggleDay(key)}
              className={
                day.enabled
                  ? "rounded-lg border border-primary bg-primary/10 px-1 py-2 text-center cursor-pointer"
                  : "rounded-lg border border-border bg-card px-1 py-2 text-center cursor-pointer"
              }
            >
              <p
                className={
                  day.enabled
                    ? "text-[10px] font-medium text-primary"
                    : "text-[10px] text-muted-foreground"
                }
              >
                {label}
              </p>
              <input
                type="number"
                min={0}
                value={day.limit}
                disabled={!day.enabled}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setLimit(key, Math.max(0, Number(e.target.value) || 0))}
                className="w-full mt-1 bg-transparent text-center text-sm font-semibold outline-none disabled:opacity-40"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
