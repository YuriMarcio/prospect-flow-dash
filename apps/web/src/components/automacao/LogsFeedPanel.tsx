import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Database,
  Instagram,
  Loader2,
  MessageCircle,
  Search,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { listCampaignLogs } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Capture } from "@/types";

function logIcon(message: string, level: "info" | "warn" | "error"): { Icon: LucideIcon; cls: string } {
  const m = message.toLowerCase();
  if (level === "error") return { Icon: XCircle, cls: "text-destructive" };
  if (level === "warn") return { Icon: AlertTriangle, cls: "text-warning-foreground dark:text-warning" };
  // WhatsApp não tem ícone próprio no lucide-react — MessageCircle como substituto visual.
  if (m.includes("whatsapp")) return { Icon: MessageCircle, cls: "text-success" };
  if (m.includes("instagram")) return { Icon: Instagram, cls: "text-primary" };
  if (/salvo|sucesso|encontrado/.test(m)) return { Icon: Database, cls: "text-success" };
  return { Icon: Search, cls: "text-muted-foreground" };
}

function isSaved(message: string, level: string) {
  return level === "info" && /salvo|sucesso|encontrado/i.test(message);
}

export function LogsFeedPanel({ campaign }: { campaign: Capture | undefined }) {
  const listRef = useRef<HTMLDivElement>(null);
  const isRunning = campaign?.status === "running";

  const logsQuery = useQuery({
    queryKey: ["logs", campaign?.id],
    queryFn: () => listCampaignLogs(campaign!.id),
    enabled: Boolean(campaign),
    refetchInterval: isRunning ? 3000 : false,
  });

  const logs = logsQuery.data ?? campaign?.logs ?? [];

  // Rola só a lista interna (não a página) até o log mais recente.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold">Logs da execução</h2>
          <p className="text-xs text-muted-foreground">Eventos mais recentes da captura ativa.</p>
        </div>
        <Link to="/capturas" className="text-xs text-primary hover:underline shrink-0">
          Ver todos
        </Link>
      </div>

      <div ref={listRef} className="divide-y divide-border max-h-80 overflow-y-auto">
        {!campaign && (
          <p className="text-sm text-muted-foreground text-center py-10">Nenhuma execução para acompanhar.</p>
        )}

        {campaign && logsQuery.isLoading && !logs.length && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Carregando logs…
          </div>
        )}

        {campaign && !logsQuery.isLoading && logs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">Sem logs disponíveis.</p>
        )}

        {logs.map((log, i) => {
          const { Icon, cls } = logIcon(log.message, log.level);
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-11">{log.time}</span>
              <Icon className={cn("h-3.5 w-3.5 shrink-0", cls)} />
              <span className="text-sm truncate flex-1">{log.message}</span>
              {isSaved(log.message, log.level) && (
                <span className="text-[10px] font-semibold bg-success/15 text-success px-2 py-0.5 rounded-full shrink-0">
                  SALVO
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
