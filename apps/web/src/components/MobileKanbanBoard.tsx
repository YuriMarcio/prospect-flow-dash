import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { KanbanColumn, Lead } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LeadCard, type BotDispatchInfo } from "@/components/LeadCard";
import { KanbanColumnMenu } from "@/components/KanbanColumn";

const PAGE_SIZE = 30;
/** Quanto o dedo precisa andar na horizontal (e o quanto isso pesa frente à vertical) pra trocar de etapa. */
const SWIPE_MIN_X = 80;
const SWIPE_RATIO = 2;

/**
 * Kanban do celular: em vez de várias colunas de 256px lado a lado (uma e meia na tela, sem
 * conseguir rolar sobre os cards), mostra UMA etapa por vez — faixa de etapas fixa no topo,
 * lista de cards em largura total e "Mover" no lugar do arrastar.
 */
export function MobileKanbanBoard({
  columns,
  leads,
  botDispatchByLeadId,
  onAddLead,
  onMoveLead,
}: {
  /** Já ordenadas. */
  columns: KanbanColumn[];
  leads: Lead[];
  botDispatchByLeadId?: Record<string, BotDispatchInfo>;
  onAddLead: (columnId: string) => void;
  onMoveLead: (leadId: string, columnId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const stripRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const leadsByColumn = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const lead of leads) {
      const list = map.get(lead.columnId);
      if (list) list.push(lead);
      else map.set(lead.columnId, [lead]);
    }
    return map;
  }, [leads]);

  // Se a coluna aberta sumir (excluída), cai na primeira
  const active = columns.find((column) => column.id === selectedId) ?? columns[0];
  const activeIndex = active ? columns.indexOf(active) : -1;
  const activeLeads = (active && leadsByColumn.get(active.id)) || [];
  const shown = activeLeads.slice(0, visibleCount);

  function select(columnId: string) {
    setSelectedId(columnId);
    setVisibleCount(PAGE_SIZE);
  }

  // Mantém a etapa aberta visível (e centralizada) na faixa horizontal
  const activeColumnId = active?.id;
  useEffect(() => {
    const strip = stripRef.current;
    const chip = activeColumnId ? chipRefs.current.get(activeColumnId) : undefined;
    if (!strip || !chip) return;
    strip.scrollTo({
      left: chip.offsetLeft - (strip.clientWidth - chip.clientWidth) / 2,
      behavior: "smooth",
    });
  }, [activeColumnId]);

  if (!active) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        Nenhuma coluna no pipeline. Use o menu ⋯ para criar uma.
      </p>
    );
  }

  function onTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_X || Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return;
    const next = columns[activeIndex + (dx < 0 ? 1 : -1)];
    if (next) select(next.id);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Etapas: fica colada no topo enquanto a lista rola */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 backdrop-blur">
        <div
          ref={stripRef}
          role="tablist"
          aria-label="Etapas do pipeline"
          className="no-scrollbar relative flex gap-2 overflow-x-auto px-4 py-2.5"
        >
          {columns.map((column) => {
            const selected = column.id === active.id;
            return (
              <button
                key={column.id}
                ref={(node) => {
                  if (node) chipRefs.current.set(column.id, node);
                  else chipRefs.current.delete(column.id);
                }}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => select(column.id)}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors",
                  selected
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground active:bg-accent",
                )}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: column.color }}
                />
                {column.title}
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums",
                    selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {leadsByColumn.get(column.id)?.length ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Etapa aberta: título, novo lead e menu da coluna */}
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: active.color }} />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{active.title}</h2>
        <span className="text-xs text-muted-foreground">
          {activeLeads.length} lead{activeLeads.length === 1 ? "" : "s"}
        </span>
        <Button variant="outline" size="sm" className="h-9" onClick={() => onAddLead(active.id)}>
          <Plus className="h-4 w-4" />
          Novo
        </Button>
        <KanbanColumnMenu column={active} triggerClassName="h-9 w-9" />
      </div>

      {/* Cards (deslizar pro lado troca de etapa) */}
      <div
        className="min-h-[40dvh] space-y-2.5 pb-4"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {shown.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            compact
            columns={columns}
            botDispatch={botDispatchByLeadId?.[lead.id]}
            onMove={(columnId) => onMoveLead(lead.id, columnId)}
          />
        ))}

        {activeLeads.length === 0 && (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border/70 px-4 text-center text-sm text-muted-foreground">
            Nenhum lead em {active.title}
          </div>
        )}

        {activeLeads.length > shown.length && (
          <Button
            variant="outline"
            className="h-11 w-full"
            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
          >
            Mostrar mais ({activeLeads.length - shown.length} restantes)
          </Button>
        )}
      </div>
    </div>
  );
}
