import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DaySchedule, Schedule } from "@/lib/prospector";

const LATE_HOUR = 20;

const DAYS: { key: keyof Schedule; label: string }[] = [
  { key: "seg", label: "Seg" },
  { key: "ter", label: "Ter" },
  { key: "qua", label: "Qua" },
  { key: "qui", label: "Qui" },
  { key: "sex", label: "Sex" },
  { key: "sab", label: "Sáb" },
  { key: "dom", label: "Dom" },
];

function parseTime(time: string): { h: number; m: number } {
  const [h, m] = time.split(":").map(Number);
  return { h: h || 0, m: m || 0 };
}

function minutesOf(time: string): number {
  const { h, m } = parseTime(time);
  return h * 60 + m;
}

function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = Math.round(totalMinutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface DayForecast {
  finishLabel: string;
  finishLate: boolean;
  fits: number;
  overflow: number;
}

function forecastForDay(
  day: DaySchedule,
  windowStart: string,
  windowEnd: string,
  intervalMs: number,
): DayForecast | null {
  if (!day.enabled || day.limit <= 0) return null;
  const startMin = minutesOf(windowStart);
  const endMin = minutesOf(windowEnd);
  const intervalMin = intervalMs / 60_000;
  if (endMin <= startMin || intervalMin <= 0) return null;

  const fits = Math.floor((endMin - startMin) / intervalMin) + 1;
  const sending = Math.min(day.limit, fits);
  const finishMin = startMin + (sending - 1) * intervalMin;

  return {
    finishLabel: `~${formatMinutes(finishMin)}`,
    finishLate: finishMin >= LATE_HOUR * 60,
    fits,
    overflow: Math.max(0, day.limit - fits),
  };
}

/**
 * Agenda semanal do board: dias com limite, janela de envio e previsão de
 * término por dia (com avisos quando passa das 20:00 ou não cabe na janela).
 */
export function AgendaCard({
  schedule,
  onScheduleChange,
  windowStart,
  windowEnd,
  onWindowChange,
  intervalMs,
}: {
  schedule: Schedule;
  onScheduleChange: (next: Schedule) => void;
  windowStart: string;
  windowEnd: string;
  onWindowChange: (start: string, end: string) => void;
  intervalMs: number;
}) {
  function toggleDay(key: keyof Schedule) {
    const day = schedule[key];
    onScheduleChange({ ...schedule, [key]: { ...day, enabled: !day.enabled } });
  }

  function setLimit(key: keyof Schedule, limit: number) {
    onScheduleChange({ ...schedule, [key]: { ...schedule[key], limit } });
  }

  const totalWeek = Object.values(schedule).reduce(
    (sum, day) => sum + (day.enabled ? day.limit : 0),
    0,
  );

  const warnings: string[] = [];
  for (const { key, label } of DAYS) {
    const forecast = forecastForDay(schedule[key], windowStart, windowEnd, intervalMs);
    if (!forecast) continue;
    if (forecast.overflow > 0) {
      warnings.push(
        `${label}: só ${forecast.fits} de ${schedule[key].limit} cabem na janela até ${windowEnd}.`,
      );
    } else if (forecast.finishLate) {
      warnings.push(`${label}: a previsão de término (${forecast.finishLabel}) passa das 20:00.`);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <p className="text-sm font-medium">Agenda semanal</p>

      <div className="grid grid-cols-7 gap-1.5">
        {DAYS.map(({ key, label }) => {
          const day: DaySchedule = schedule[key];
          const forecast = forecastForDay(day, windowStart, windowEnd, intervalMs);
          const hasWarning = Boolean(forecast && (forecast.finishLate || forecast.overflow > 0));

          if (!day.enabled) {
            return (
              <div
                key={key}
                onClick={() => toggleDay(key)}
                className="rounded-lg border border-dashed border-border px-1 py-2 text-center cursor-pointer opacity-50 hover:opacity-80"
                title="Clique para ligar este dia"
              >
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">·</p>
                <p className="mt-0.5 h-3.5 text-[9px] text-muted-foreground">desligado</p>
              </div>
            );
          }

          return (
            <div
              key={key}
              onClick={() => toggleDay(key)}
              className={`rounded-lg border px-1 py-2 text-center cursor-pointer ${
                hasWarning ? "border-amber-500/60 bg-amber-500/10" : "border-primary bg-primary/10"
              }`}
              title="Clique para desligar este dia"
            >
              <p
                className={`text-[10px] font-medium ${hasWarning ? "text-amber-600" : "text-primary"}`}
              >
                {label}
              </p>
              <input
                type="number"
                min={0}
                value={day.limit}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setLimit(key, Math.max(0, Number(e.target.value) || 0))}
                className="w-full mt-1 bg-transparent text-center text-sm font-semibold outline-none"
              />
              <p className="mt-0.5 h-3.5 text-[9px] text-muted-foreground">
                {forecast ? (
                  <span
                    className={
                      forecast.finishLate || forecast.overflow > 0 ? "text-amber-600" : undefined
                    }
                  >
                    {forecast.overflow > 0
                      ? `só ${forecast.fits} saem`
                      : `até ${forecast.finishLabel}`}
                  </span>
                ) : (
                  " "
                )}
              </p>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Número = máximo de leads novos por dia · clique no dia para ligar/desligar.
      </p>

      <div className="flex items-end gap-3 border-t border-border pt-3 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs">Enviar a partir de</Label>
          <Input
            type="time"
            value={windowStart}
            onChange={(e) => onWindowChange(e.target.value, windowEnd)}
            className="h-8 w-28 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">até</Label>
          <Input
            type="time"
            value={windowEnd}
            onChange={(e) => onWindowChange(windowStart, e.target.value)}
            className="h-8 w-28 text-xs"
          />
        </div>
        <p className="pb-1.5 text-[11px] text-muted-foreground">
          Total planejado: <b>{totalWeek} leads/semana</b> · envio a cada ~
          {Math.round(intervalMs / 60_000)}min. Fora da janela nada é enviado — follow-ups aguardam
          a próxima janela.
        </p>
      </div>

      {warnings.length > 0 && (
        <div className="space-y-1.5">
          {warnings.map((warning) => (
            <div
              key={warning}
              className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-600 dark:text-amber-400"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <p>{warning}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
