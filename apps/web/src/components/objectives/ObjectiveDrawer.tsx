import { Link2, Pencil, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Objective, ObjectiveColumn, Sprint } from "@/lib/objectives";
import { areaMeta, formatObjectiveCode, formatShortDate, priorityMeta, sprintLabel } from "@/lib/objectiveMeta";
import { MilestoneSection, type TreeActions } from "./MilestoneSection";

export function ObjectiveDrawer({
  objective,
  onClose,
  columns,
  sprint,
  assigneeName,
  linkedPageTitle,
  childrenOf,
  onEdit,
  onChangeColumn,
  onOpenLinkedPage,
  onPickLinkedPage,
  onUnlinkPage,
  ...actions
}: {
  objective: Objective | null;
  onClose: () => void;
  columns: ObjectiveColumn[];
  sprint?: Sprint | null;
  assigneeName?: string | null;
  linkedPageTitle?: string;
  childrenOf: (id: string) => Objective[];
  onEdit: () => void;
  onChangeColumn: (columnId: string) => void;
  onOpenLinkedPage: () => void;
  onPickLinkedPage: () => void;
  onUnlinkPage: () => void;
} & TreeActions) {
  const milestones = objective ? childrenOf(objective.id) : [];
  const milestonesDone = milestones.filter((m) => m.progress >= 100).length;
  const area = areaMeta(objective?.area);
  const priority = priorityMeta(objective?.priority);

  return (
    <Sheet open={Boolean(objective)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[620px]">
        {objective && (
          <>
            <div className="flex items-center justify-between border-b border-border py-4 pl-6 pr-14">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {formatObjectiveCode(objective)} · Detalhes do objetivo
              </p>
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </button>
            </div>

            <div className="space-y-3 border-b border-border px-6 py-5">
              {(area || priority) && (
                <div className="flex items-center gap-3">
                  {area && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                        area.tag,
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", area.dot)} />
                      {area.label}
                    </span>
                  )}
                  {priority && (
                    <span className={cn("text-[11px] font-medium", priority.className)}>
                      Prioridade {priority.label.toLowerCase()}
                    </span>
                  )}
                </div>
              )}
              <SheetTitle className="text-xl font-bold leading-tight">{objective.title}</SheetTitle>
              <SheetDescription className={cn("text-sm", !objective.description && "sr-only")}>
                {objective.description || "Sem descrição."}
              </SheetDescription>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                <p>
                  Responsável: <span className="font-semibold text-foreground">{assigneeName ?? "—"}</span>
                </p>
                <p>
                  Prazo:{" "}
                  <span className="font-semibold text-foreground">
                    {objective.dueDate ? formatShortDate(objective.dueDate) : "—"}
                  </span>
                </p>
                <p>
                  Ciclo: <span className="font-semibold text-foreground">{sprint ? sprintLabel(sprint) : "—"}</span>
                </p>
              </div>

              <div>
                {objective.linkedPageId ? (
                  <button
                    type="button"
                    onClick={onOpenLinkedPage}
                    className="group/chip flex w-fit items-center gap-1.5 rounded-full border border-border bg-accent/40 px-2.5 py-1 text-xs hover:border-primary/40"
                  >
                    <Link2 className="h-3 w-3 text-primary" />
                    {linkedPageTitle || "Página do Workspace"}
                    <span
                      role="button"
                      aria-label="Desvincular página"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnlinkPage();
                      }}
                      className="grid h-3.5 w-3.5 place-items-center rounded-full hover:bg-muted md:opacity-0 md:group-hover/chip:opacity-100"
                    >
                      <X className="h-2.5 w-2.5" />
                    </span>
                  </button>
                ) : (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onPickLinkedPage}>
                    <Link2 className="mr-1 h-3.5 w-3.5" />
                    Vincular página
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4">
              <Label className="text-sm font-semibold">Etapa do objetivo</Label>
              <Select value={objective.columnId ?? undefined} onValueChange={onChangeColumn}>
                <SelectTrigger className="h-9 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      {column.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mx-6 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Progresso do objetivo ·{" "}
                  <span className="font-semibold text-foreground">
                    {milestones.length > 0
                      ? `${milestonesDone}/${milestones.length} marcos entregues`
                      : "sem marcos ainda"}
                  </span>
                </p>
                <span className="text-xl font-bold">{objective.progress}%</span>
              </div>
              <Progress value={objective.progress} className="mt-2.5 h-1.5" />
            </div>

            <div className="px-6 py-6">
              <MilestoneSection objective={objective} childrenOf={childrenOf} {...actions} />
            </div>

            <div className="mx-6 mb-6 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-primary">Como o progresso funciona?</span> As subissues compõem a
              conclusão de cada issue; as issues compõem o marco; e a média dos marcos determina o progresso do
              objetivo. O status no Kanban é independente do percentual.
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
