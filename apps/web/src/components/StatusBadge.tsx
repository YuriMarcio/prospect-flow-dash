import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/types";

const map: Record<LeadStatus | string, { label: string; cls: string }> = {
  novo: { label: "Novo", cls: "bg-muted text-muted-foreground" },
  contato: { label: "Em contato", cls: "bg-info/15 text-info" },
  qualificado: { label: "Qualificado", cls: "bg-primary/15 text-primary" },
  negociacao: { label: "Negociação", cls: "bg-warning/20 text-warning-foreground dark:text-warning" },
  ganho: { label: "Ganho", cls: "bg-success/15 text-success" },
  perdido: { label: "Perdido", cls: "bg-destructive/15 text-destructive" },
  running: { label: "Em execução", cls: "bg-info/15 text-info" },
  done: { label: "Concluído", cls: "bg-success/15 text-success" },
  error: { label: "Erro", cls: "bg-destructive/15 text-destructive" },
  queued: { label: "Na fila", cls: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelado", cls: "bg-warning/20 text-warning-foreground dark:text-warning" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", s.cls, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {s.label}
    </span>
  );
}
