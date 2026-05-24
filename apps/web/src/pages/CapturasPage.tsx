import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { mockCaptures } from "@/mock/data";
import { ChevronDown, ChevronRight } from "lucide-react";

export function CapturasPage() {
  const [open, setOpen] = useState<string | null>(mockCaptures[0]?.id ?? null);

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Execuções</h1>
        <p className="text-sm text-muted-foreground mt-1">Histórico e status das automações de captura.</p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-8" />
              <th className="text-left px-4 py-3">Captura</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Progresso</th>
              <th className="text-left px-4 py-3">Encontrados</th>
              <th className="text-left px-4 py-3">Erros</th>
              <th className="text-left px-4 py-3">Tempo</th>
            </tr>
          </thead>
          <tbody>
            {mockCaptures.flatMap((c) => {
              const pct = Math.round((c.processed / c.quantity) * 100);
              const isOpen = open === c.id;
              const rows = [
                <tr
                  key={`${c.id}-main`}
                  className="border-t border-border hover:bg-accent/40 transition cursor-pointer"
                  onClick={() => setOpen(isOpen ? null : c.id)}
                >
                  <td className="pl-4">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.category} • {c.city}</div>
                    <div className="text-xs text-muted-foreground">{c.startedAt} {c.neighborhood && `• ${c.neighborhood}`}</div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 w-56">
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="h-1.5" />
                      <span className="text-xs text-muted-foreground w-10">{pct}%</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{c.processed} / {c.quantity}</p>
                  </td>
                  <td className="px-4 py-3 font-medium">{c.found}</td>
                  <td className="px-4 py-3 text-destructive">{c.errors}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.duration}</td>
                </tr>,
              ];

              if (isOpen) {
                rows.push(
                  <tr key={`${c.id}-logs`} className="border-t border-border bg-muted/20">
                    <td />
                    <td colSpan={6} className="px-4 py-4">
                      <p className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wide">Logs</p>
                      <div className="font-mono text-xs rounded-lg bg-background border border-border p-3 space-y-1 max-h-48 overflow-y-auto">
                        {c.logs.length === 0 && <p className="text-muted-foreground">Sem logs disponíveis.</p>}
                        {c.logs.map((l, i) => (
                          <div key={i} className="flex gap-3">
                            <span className="text-muted-foreground">{l.time}</span>
                            <span className={l.level === "error" ? "text-destructive" : l.level === "warn" ? "text-warning" : "text-foreground"}>
                              [{l.level.toUpperCase()}]
                            </span>
                            <span>{l.message}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>,
                );
              }

              return rows;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
