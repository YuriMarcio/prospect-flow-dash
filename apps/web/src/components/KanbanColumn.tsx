import { useDroppable } from "@dnd-kit/core";
import { MoreHorizontal, Plus } from "lucide-react";
import type { KanbanColumn as KanbanColumnT, Lead } from "@/types";
import { LeadCard } from "./LeadCard";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useKanbanStore } from "@/store/kanban";

export function KanbanColumn({ column, leads }: { column: KanbanColumnT; leads: Lead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const { deleteColumn, updateColumn } = useKanbanStore();

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl bg-muted/40 border border-border">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <span className="h-2 w-2 rounded-full" style={{ background: column.color }} />
        <h3 className="text-sm font-semibold truncate">{column.title}</h3>
        <span className="text-xs text-muted-foreground">{leads.length}</span>
        <div className="ml-auto flex items-center">
          <button className="h-7 w-7 grid place-items-center rounded-md hover:bg-accent" aria-label="Adicionar lead">
            <Plus className="h-4 w-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-7 w-7 grid place-items-center rounded-md hover:bg-accent">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                const t = prompt("Novo nome da coluna", column.title);
                if (t) updateColumn(column.id, { title: t });
              }}>Renomear</DropdownMenuItem>
              <DropdownMenuItem onClick={() => deleteColumn(column.id)} className="text-destructive">
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-32 p-2 space-y-2 overflow-y-auto transition-colors ${
          isOver ? "bg-primary/5" : ""
        }`}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
        {leads.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8 border border-dashed border-border rounded-lg">
            Solte leads aqui
          </div>
        )}
      </div>
    </div>
  );
}
