import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Objective, ObjectiveArea, ObjectiveColumn, ObjectivePriority, Sprint, TeamUser } from "@/lib/objectives";
import { OBJECTIVE_AREAS, OBJECTIVE_PRIORITIES, sprintLabel } from "@/lib/objectiveMeta";

export interface ObjectiveFormValues {
  title: string;
  description: string;
  area: ObjectiveArea | null;
  columnId: string;
  assignedUserId: string | null;
  dueDate: string | null;
  sprintId: string | null;
  priority: ObjectivePriority;
  progress: number;
}

const NONE = "none";

function buildInitialValues(
  objective: Objective | null | undefined,
  defaultColumnId: string,
  defaultArea: ObjectiveArea | null,
): ObjectiveFormValues {
  if (objective) {
    return {
      title: objective.title,
      description: objective.description ?? "",
      area: objective.area,
      columnId: objective.columnId ?? defaultColumnId,
      assignedUserId: objective.assignedUserId,
      dueDate: objective.dueDate ? objective.dueDate.slice(0, 10) : null,
      sprintId: objective.sprintId,
      priority: objective.priority ?? "media",
      progress: objective.progress,
    };
  }
  return {
    title: "",
    description: "",
    area: defaultArea,
    columnId: defaultColumnId,
    assignedUserId: null,
    dueDate: null,
    sprintId: null,
    priority: "media",
    progress: 0,
  };
}

/** Formulário de objetivo — o mesmo para criar e para editar. */
export function ObjectiveFormDialog({
  open,
  onOpenChange,
  objective,
  defaultColumnId,
  defaultArea,
  columns,
  sprints,
  teamUsers,
  hasMilestones,
  submitting,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presente = edição; ausente = criação. */
  objective?: Objective | null;
  defaultColumnId: string;
  defaultArea: ObjectiveArea | null;
  columns: ObjectiveColumn[];
  sprints: Sprint[];
  teamUsers: TeamUser[];
  /** Com marcos o progresso é calculado a partir deles — o slider só vale sem marcos. */
  hasMilestones: boolean;
  submitting: boolean;
  onSubmit: (values: ObjectiveFormValues) => void;
  onDelete?: () => void;
}) {
  const [values, setValues] = useState<ObjectiveFormValues>(() =>
    buildInitialValues(objective, defaultColumnId, defaultArea),
  );

  useEffect(() => {
    if (open) setValues(buildInitialValues(objective, defaultColumnId, defaultArea));
    // Só reinicia ao abrir (ou ao trocar de objetivo) — não a cada digitação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, objective?.id, defaultColumnId]);

  const isEdit = Boolean(objective);
  const set = <K extends keyof ObjectiveFormValues>(key: K, value: ObjectiveFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const canSubmit = values.title.trim().length > 0 && Boolean(values.columnId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onSubmit({ ...values, title: values.title.trim() });
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar objetivo" : "Novo objetivo"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label className="text-xs">Título do objetivo *</Label>
            <Input
              autoFocus
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ex.: Ativar 10 lojistas no Galeão"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Descrição / resultado esperado</Label>
            <Textarea
              rows={3}
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="O que queremos alcançar?"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Área responsável</Label>
              <Select
                value={values.area ?? NONE}
                onValueChange={(value) => set("area", value === NONE ? null : (value as ObjectiveArea))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem área</SelectItem>
                  {OBJECTIVE_AREAS.map((area) => (
                    <SelectItem key={area.value} value={area.value}>
                      {area.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Etapa</Label>
              <Select value={values.columnId} onValueChange={(value) => set("columnId", value)}>
                <SelectTrigger>
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

            <div className="space-y-1.5">
              <Label className="text-xs">Responsável</Label>
              <Select
                value={values.assignedUserId ?? NONE}
                onValueChange={(value) => set("assignedUserId", value === NONE ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Ninguém</SelectItem>
                  {teamUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.username || user.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Prazo</Label>
              <Input
                type="date"
                value={values.dueDate ?? ""}
                onChange={(e) => set("dueDate", e.target.value || null)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Sprint</Label>
              <Select
                value={values.sprintId ?? NONE}
                onValueChange={(value) => set("sprintId", value === NONE ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhuma</SelectItem>
                  {sprints.map((sprint) => (
                    <SelectItem key={sprint.id} value={sprint.id}>
                      {sprintLabel(sprint)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Prioridade</Label>
              <Select value={values.priority} onValueChange={(value) => set("priority", value as ObjectivePriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OBJECTIVE_PRIORITIES.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isEdit && !hasMilestones && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Progresso</Label>
                <span className="text-xs text-muted-foreground">{values.progress}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={values.progress}
                onChange={(e) => set("progress", Number(e.target.value))}
                className="w-full"
              />
              <Progress value={values.progress} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">
                Adicione marcos no detalhe do objetivo para o progresso ser calculado automaticamente.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            {isEdit && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Excluir
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!canSubmit || submitting}>
                {isEdit ? "Salvar alterações" : "Criar objetivo"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
