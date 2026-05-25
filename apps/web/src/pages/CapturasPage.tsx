import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { ChevronDown, ChevronRight } from "lucide-react";
import { listCampaignLogs, listCampaigns } from "@/lib/api";

export function CapturasPage() {
  const campaignsQuery = useQuery({
    queryKey: ["campaigns"],
    queryFn: listCampaigns,
    retry: 1,
  });
  const captures = useMemo(() => campaignsQuery.data ?? [], [campaignsQuery.data]);
  const [open, setOpen] = useState<string | null>(null);
  const logsQuery = useQuery({
    queryKey: ["campaign-logs", open],
    queryFn: () => listCampaignLogs(open!),
    enabled: Boolean(open),
    retry: 1,
  });

  useEffect(() => {
    if (!open && captures[0]) setOpen(captures[0].id);
  }, [captures, open]);

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Execuções</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {campaignsQuery.isLoading
            ? "Carregando automações..."
            : "Histórico e status das automações de captura."}
        </p>
        {campaignsQuery.isError && (
          <p className="text-sm text-destructive mt-1">
            Não foi possível carregar as execuções da API.
          </p>
        )}
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
            {captures.flatMap((capture) => {
              const pct = capture.quantity
                ? Math.min(100, Math.round((capture.processed / capture.quantity) * 100))
                : 0;
              const isOpen = open === capture.id;
              const logs = isOpen ? (logsQuery.data ?? capture.logs) : capture.logs;
              const rows = [
                <tr
                  key={`${capture.id}-main`}
                  className="border-t border-border hover:bg-accent/40 transition cursor-pointer"
                  onClick={() => setOpen(isOpen ? null : capture.id)}
                >
                  <td className="pl-4">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {capture.category} • {capture.city}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {capture.startedAt} {capture.neighborhood && `• ${capture.neighborhood}`}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={capture.status} />
                  </td>
                  <td className="px-4 py-3 w-56">
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="h-1.5" />
                      <span className="text-xs text-muted-foreground w-10">{pct}%</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {capture.processed} / {capture.quantity}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-medium">{capture.found}</td>
                  <td className="px-4 py-3 text-destructive">{capture.errors}</td>
                  <td className="px-4 py-3 text-muted-foreground">{capture.duration}</td>
                </tr>,
              ];

              if (isOpen) {
                rows.push(
                  <tr key={`${capture.id}-logs`} className="border-t border-border bg-muted/20">
                    <td />
                    <td colSpan={6} className="px-4 py-4">
                      <p className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wide">
                        Logs
                      </p>
                      <div className="font-mono text-xs rounded-lg bg-background border border-border p-3 space-y-1 max-h-48 overflow-y-auto">
                        {logsQuery.isLoading && (
                          <p className="text-muted-foreground">Carregando logs...</p>
                        )}
                        {!logsQuery.isLoading && logs.length === 0 && (
                          <p className="text-muted-foreground">Sem logs disponíveis.</p>
                        )}
                        {logs.map((log, index) => (
                          <div key={index} className="flex gap-3">
                            <span className="text-muted-foreground">{log.time}</span>
                            <span
                              className={
                                log.level === "error"
                                  ? "text-destructive"
                                  : log.level === "warn"
                                    ? "text-warning"
                                    : "text-foreground"
                              }
                            >
                              [{log.level.toUpperCase()}]
                            </span>
                            <span>{log.message}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>,
                );
              }

              return rows;
            })}
            {!campaignsQuery.isLoading && captures.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  Nenhuma execução encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
