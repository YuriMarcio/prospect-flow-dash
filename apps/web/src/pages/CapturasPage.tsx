import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { ChevronDown, ChevronRight, Loader2, Plus, Terminal } from "lucide-react";
import { createCampaign, listCampaignLogs, listCampaigns } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Capture } from "@/types";

const CATEGORY_SUGGESTIONS = [
  "Restaurante", "Pizzaria", "Hamburgueria", "Pet Shop", "Barbearia",
  "Salão de Beleza", "Academia", "Farmácia", "Clínica", "Padaria",
  "Açaí", "Cafeteria", "Japonês", "Churrascaria", "Lanchonete",
];

// ─── Terminal de logs ────────────────────────────────────────────────────────

function LogTerminal({
  logs,
  isLoading,
  isRunning,
}: {
  logs: Capture["logs"];
  isLoading: boolean;
  isRunning: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  return (
    <div className="rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-zinc-800">
        <span className="h-3 w-3 rounded-full bg-red-500/70" />
        <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
        <span className="h-3 w-3 rounded-full bg-green-500/70" />
        <Terminal className="h-3.5 w-3.5 text-zinc-500 ml-2" />
        <span className="text-xs text-zinc-500 font-mono">capture.log</span>
        {isRunning && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-green-400 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      {/* Log output */}
      <div className="font-mono text-xs p-3 space-y-0.5 max-h-72 overflow-y-auto text-zinc-300">
        {isLoading && !logs.length && (
          <div className="flex items-center gap-2 text-zinc-500 py-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Carregando logs…</span>
          </div>
        )}

        {!isLoading && logs.length === 0 && (
          <p className="text-zinc-600 py-2">$ Sem logs disponíveis.</p>
        )}

        {logs.map((log, i) => (
          <div key={i} className="flex gap-2 leading-5">
            <span className="text-zinc-600 shrink-0 tabular-nums">{log.time}</span>
            <span
              className={
                log.level === "error"
                  ? "text-red-400 shrink-0"
                  : log.level === "warn"
                    ? "text-yellow-400 shrink-0"
                    : "text-zinc-500 shrink-0"
              }
            >
              [{log.level.toUpperCase().padEnd(4)}]
            </span>
            <span
              className={
                log.level === "error"
                  ? "text-red-300"
                  : log.level === "warn"
                    ? "text-yellow-300"
                    : "text-zinc-300"
              }
            >
              {log.message}
            </span>
          </div>
        ))}

        {isRunning && (
          <div className="flex items-center gap-1 text-green-400 pt-1">
            <span className="animate-pulse">▋</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─── Dialog nova campanha ────────────────────────────────────────────────────

function NewCampaignDialog({
  open,
  onOpenChange,
  disabled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [quantity, setQuantity] = useState("100");

  const mutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      onOpenChange(false);
      setCategory(""); setCity(""); setNeighborhood(""); setQuantity("100");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category.trim() || !city.trim()) return;
    mutation.mutate({
      category: category.trim(),
      city: city.trim(),
      neighborhood: neighborhood.trim() || undefined,
      quantity: Math.max(1, parseInt(quantity, 10) || 100),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Campanha de Captação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="nc-category">Segmento *</Label>
            <Input
              id="nc-category"
              list="nc-category-suggestions"
              placeholder="ex: Restaurante, Pet Shop…"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
            <datalist id="nc-category-suggestions">
              {CATEGORY_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-city">Cidade *</Label>
            <Input id="nc-city" placeholder="ex: São Paulo" value={city} onChange={(e) => setCity(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-neighborhood">Bairro (opcional)</Label>
            <Input id="nc-neighborhood" placeholder="ex: Pinheiros" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-quantity">Quantidade de leads *</Label>
            <Input id="nc-quantity" type="number" min={1} max={1000} placeholder="100" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </div>
          {mutation.isError && <p className="text-sm text-destructive">Erro ao iniciar campanha. Tente novamente.</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending || disabled}>
              {mutation.isPending ? "Iniciando…" : "Iniciar campanha"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export function CapturasPage() {
  const campaignsQuery = useQuery({
    queryKey: ["campaigns"],
    queryFn: listCampaigns,
    retry: 1,
    // Polling automático enquanto houver captura rodando
    refetchInterval: (query) => {
      const data = query.state.data as Capture[] | undefined;
      return data?.some((c) => c.status === "running") ? 3000 : false;
    },
  });

  const captures = useMemo(() => campaignsQuery.data ?? [], [campaignsQuery.data]);

  // Detecta captura em andamento
  const runningCapture = captures.find((c) => c.status === "running");
  const isRunning = Boolean(runningCapture);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Auto-expande a captura em execução
  useEffect(() => {
    if (runningCapture) setExpandedId(runningCapture.id);
    else if (!expandedId && captures[0]) setExpandedId(captures[0].id);
  }, [runningCapture?.id, captures.length]);

  const logsQuery = useQuery({
    queryKey: ["campaign-logs", expandedId],
    queryFn: () => listCampaignLogs(expandedId!),
    enabled: Boolean(expandedId),
    retry: 1,
    // Polling de logs quando a captura expandida está rodando
    refetchInterval: (query) => {
      if (!expandedId) return false;
      const capture = captures.find((c) => c.id === expandedId);
      return capture?.status === "running" ? 3000 : false;
    },
  });

  const logs = logsQuery.data ?? captures.find((c) => c.id === expandedId)?.logs ?? [];

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <NewCampaignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        disabled={isRunning}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Execuções</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRunning ? (
              <span className="flex items-center gap-1.5 text-green-500">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Captura em andamento — logs ao vivo
              </span>
            ) : campaignsQuery.isLoading ? (
              "Carregando automações…"
            ) : (
              "Histórico e status das automações de captura."
            )}
          </p>
          {campaignsQuery.isError && (
            <p className="text-sm text-destructive mt-1">Não foi possível carregar as execuções da API.</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-lg px-3 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Aguarde a captura terminar
            </span>
          )}
          <Button onClick={() => setDialogOpen(true)} disabled={isRunning}>
            <Plus className="h-4 w-4" />
            Nova campanha
          </Button>
        </div>
      </div>

      {/* Tabela + terminal inline */}
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
              const isExpanded = expandedId === capture.id;
              const captureIsRunning = capture.status === "running";

              const rows = [
                <tr
                  key={`${capture.id}-main`}
                  className={`border-t border-border hover:bg-accent/40 transition cursor-pointer ${
                    captureIsRunning ? "bg-green-500/5" : ""
                  }`}
                  onClick={() => setExpandedId(isExpanded ? null : capture.id)}
                >
                  <td className="pl-4">
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4" />
                      : <ChevronRight className="h-4 w-4" />}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium flex items-center gap-2">
                      {capture.category} • {capture.city}
                      {captureIsRunning && (
                        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {capture.startedAt}
                      {capture.neighborhood && ` • ${capture.neighborhood}`}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={capture.status} />
                  </td>
                  <td className="px-4 py-3 w-56">
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="h-1.5" />
                      <span className="text-xs text-muted-foreground w-10 tabular-nums">{pct}%</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                      {capture.processed} / {capture.quantity}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums">{capture.found}</td>
                  <td className="px-4 py-3 text-destructive tabular-nums">{capture.errors}</td>
                  <td className="px-4 py-3 text-muted-foreground">{capture.duration}</td>
                </tr>,
              ];

              if (isExpanded) {
                rows.push(
                  <tr key={`${capture.id}-logs`} className="border-t border-border bg-zinc-950/40">
                    <td />
                    <td colSpan={6} className="px-4 py-4">
                      <LogTerminal
                        logs={logs}
                        isLoading={logsQuery.isLoading}
                        isRunning={captureIsRunning}
                      />
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
