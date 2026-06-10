import { useDroppable } from "@dnd-kit/core";
import { MoreHorizontal, Plus } from "lucide-react";
import type { KanbanColumn as KanbanColumnT, Lead } from "@/types";
import { LeadCard } from "./LeadCard";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useKanbanStore } from "@/store/kanban";

const MAX_VISIBLE = 30;

export function KanbanColumn({ column, leads }: { column: KanbanColumnT; leads: Lead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const { deleteColumn, updateColumn } = useKanbanStore();

  const visible = leads.slice(0, MAX_VISIBLE);
  const hidden = leads.length - visible.length;

  return (
    <div
      className={`flex w-64 shrink-0 flex-col rounded-xl border transition-colors h-full ${
        isOver ? "border-primary/50 bg-primary/5" : "border-border bg-muted/30"
      }`}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: column.color }} />
        <h3 className="text-sm font-semibold truncate flex-1">{column.title}</h3>
        <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 min-w-5 text-center">
          {leads.length}
        </span>
        <div className="flex items-center">
          <button
            className="h-6 w-6 grid place-items-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Adicionar lead"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-6 w-6 grid place-items-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  const t = prompt("Novo nome da coluna", column.title);
                  if (t) updateColumn(column.id, { title: t });
                }}
              >
                Renomear
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => deleteColumn(column.id)}
                className="text-destructive focus:text-destructive"
              >
                Excluir coluna
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className="flex-1 min-h-0 p-2 space-y-2 overflow-y-auto"
      >
        {visible.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}

        {leads.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg">
            Solte leads aqui
          </div>
        )}

        {hidden > 0 && (
          <p className="text-center text-[11px] text-muted-foreground py-1">
            + {hidden} oculto{hidden !== 1 ? "s" : ""} (use filtros)
          </p>
        )}
      </div>
    </div>
  );
}
