import { useDraggable } from "@dnd-kit/core";
import { CalendarClock, Layers, Link2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Objective } from "@/lib/objectives";
import type { MilestoneStats } from "@/lib/objectiveTree";
import { areaMeta, formatShortDate, priorityMeta } from "@/lib/objectiveMeta";

export function ObjectiveCard({
  objective,
  overlay = false,
  onOpen,
  assigneeName,
  sprintName,
  milestoneStats,
}: {
  objective: Objective;
  overlay?: boolean;
  onOpen?: (objective: Objective) => void;
  assigneeName?: string | null;
  sprintName?: string | null;
  milestoneStats?: MilestoneStats;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: objective.id,
    disabled: overlay,
  });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  const area = areaMeta(objective.area);
  const priority = priorityMeta(objective.priority);
  const hasFooter = Boolean(sprintName || objective.dueDate || objective.linkedPageId || assigneeName);

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={() => onOpen?.(objective)}
      className={cn(
        "rounded-xl border border-border bg-card p-3.5 text-left shadow-sm cursor-grab active:cursor-grabbing transition-opacity",
        isDragging && "opacity-40",
        overlay && "shadow-lg rotate-2",
      )}
    >
      {(area || priority) && (
        <div className="flex items-center justify-between gap-2">
          {area ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                area.tag,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", area.dot)} />
              {area.label}
            </span>
          ) : (
            <span />
          )}
          {priority && <span className={cn("text-[11px] font-medium", priority.className)}>{priority.label}</span>}
        </div>
      )}

      <p className={cn("text-sm font-semibold leading-snug", (area || priority) && "mt-2.5")}>{objective.title}</p>

      {objective.description && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{objective.description}</p>
      )}

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{milestoneStats ? `${milestoneStats.done}/${milestoneStats.total} marcos concluídos` : "Progresso"}</span>
          <span className="font-medium text-foreground">{objective.progress}%</span>
        </div>
        <Progress value={objective.progress} className="h-1.5" />
      </div>

      {hasFooter && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5 text-[11px] text-muted-foreground">
            {sprintName && (
              <span className="flex min-w-0 items-center gap-1">
                <Layers className="h-3 w-3 shrink-0" />
                <span className="truncate">{sprintName}</span>
              </span>
            )}
            {objective.dueDate && (
              <span className="flex shrink-0 items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                {formatShortDate(objective.dueDate)}
              </span>
            )}
            {objective.linkedPageId && <Link2 className="h-3 w-3 shrink-0" />}
          </div>
          {assigneeName && (
            <span
              title={assigneeName}
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
            >
              {assigneeName.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
