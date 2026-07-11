import { X } from "lucide-react";
import type { LeadStatus } from "@/types";

const STAGES: { label: string; color: string }[] = [
  { label: "a prospectar", color: "oklch(0.7 0.05 260)" },
  { label: "em prospecção", color: "oklch(0.7 0.15 235)" },
  { label: "negociação", color: "oklch(0.78 0.16 75)" },
  { label: "venda fechada", color: "oklch(0.65 0.17 155)" },
];

const STAGE_INDEX: Record<Exclude<LeadStatus, "perdido">, number> = {
  novo: 0,
  contato: 1,
  qualificado: 1,
  negociacao: 2,
  ganho: 3,
};

export function LeadStageProgress({ status }: { status: LeadStatus }) {
  if (status === "perdido") {
    return (
      <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-destructive/10 border border-destructive/20 px-2 py-0.5 text-[10px] font-medium text-destructive">
        <X className="h-3 w-3" />
        Perdido
      </div>
    );
  }

  const index = STAGE_INDEX[status];
  const stage = STAGES[index];

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {STAGES.map((s, i) => (
          <span
            key={s.label + i}
            className={`h-1 flex-1 rounded-full ${i <= index ? "" : "bg-muted"}`}
            style={i <= index ? { background: stage.color } : undefined}
          />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Etapa {index + 1} de {STAGES.length} · {stage.label}
      </p>
    </div>
  );
}
