import { useDroppable } from "@dnd-kit/core";
import { CheckCircle2, MoreHorizontal } from "lucide-react";
import type { Objective, ObjectiveColumn as ObjectiveColumnT } from "@/lib/objectives";
import { ObjectiveCard } from "./ObjectiveCard";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function ObjectiveColumn({
  column,
  objectives,
  onRename,
  onDelete,
  onToggleDone,
  onOpenObjective,
  assigneeNameById,
  sprintNameById,
}: {
  column: ObjectiveColumnT;
  objectives: Objective[];
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onToggleDone: (id: string, isDone: boolean) => void;
  onOpenObjective: (objective: Objective) => void;
  assigneeNameById: Record<string, string>;
  sprintNameById: Record<string, string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      className={`flex w-72 shrink-0 flex-col rounded-xl border transition-colors h-full ${
        isOver ? "border-primary/50 bg-primary/5" : "border-border bg-muted/30"
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: column.color }} />
        <h3 className="text-sm font-semibold truncate flex-1">{column.title}</h3>
        {column.isDone && <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />}
        <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 min-w-5 text-center">
          {objectives.length}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-6 w-6 grid place-items-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                const t = window.prompt("Novo nome da coluna", column.title);
                if (t) onRename(column.id, t);
              }}
            >
              Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleDone(column.id, !column.isDone)}>
              {column.isDone ? "Desmarcar como concluído" : "Marcar como concluído"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(column.id)}
              className="text-destructive focus:text-destructive"
            >
              Excluir coluna
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div ref={setNodeRef} className="flex-1 min-h-0 p-2 space-y-2 overflow-y-auto">
        {objectives.map((objective) => (
          <ObjectiveCard
            key={objective.id}
            objective={objective}
            onOpen={onOpenObjective}
            assigneeName={objective.assignedUserId ? assigneeNameById[objective.assignedUserId] : null}
            sprintName={objective.sprintId ? sprintNameById[objective.sprintId] : null}
          />
        ))}

        {objectives.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg">
            Solte objetivos aqui
          </div>
        )}
      </div>
    </div>
  );
}
