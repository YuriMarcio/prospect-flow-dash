import { useDraggable } from "@dnd-kit/core";
import { CalendarClock, Link2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { Objective } from "@/lib/objectives";

export function ObjectiveCard({
  objective,
  overlay = false,
  onOpen,
}: {
  objective: Objective;
  overlay?: boolean;
  onOpen?: (objective: Objective) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: objective.id,
    disabled: overlay,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const dueLabel = objective.dueDate
    ? new Date(objective.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    : null;

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={() => onOpen?.(objective)}
      className={`rounded-lg border border-border bg-card p-3 text-left shadow-sm cursor-grab active:cursor-grabbing transition-opacity ${
        isDragging ? "opacity-40" : ""
      } ${overlay ? "shadow-lg rotate-2" : ""}`}
    >
      <p className="text-sm font-medium leading-snug">{objective.title}</p>

      {objective.description && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{objective.description}</p>
      )}

      <div className="mt-2.5 space-y-1">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Progresso</span>
          <span>{objective.progress}%</span>
        </div>
        <Progress value={objective.progress} className="h-1.5" />
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {objective.owner && (
            <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-[10px] font-medium text-primary">
              {objective.owner.slice(0, 2).toUpperCase()}
            </span>
          )}
          {objective.linkedPageId && <Link2 className="h-3 w-3 text-muted-foreground" />}
        </div>
        {dueLabel && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarClock className="h-3 w-3" />
            {dueLabel}
          </span>
        )}
      </div>
    </div>
  );
}
