import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useObjectivesStore } from "@/store/objectives";
import { useObjectivesSync } from "@/hooks/use-objectives-sync";
import { useWorkspaceStore } from "@/store/workspace";
import { useWorkspaceSync } from "@/hooks/use-workspace-sync";
import { ObjectiveColumn } from "@/components/objectives/ObjectiveColumn";
import { ObjectiveCard } from "@/components/objectives/ObjectiveCard";
import { WorkspacePagePicker } from "@/components/objectives/WorkspacePagePicker";
import {
  createObjective,
  createObjectiveColumn,
  createSprint,
  deleteObjective,
  deleteObjectiveColumn,
  listSprints,
  listTeamUsers,
  updateObjective,
  updateObjectiveColumn,
  type Objective,
} from "@/lib/objectives";

export function ObjectivesPage() {
  useObjectivesSync();
  useWorkspaceSync();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const columns = useObjectivesStore((s) => s.columns);
  const objectives = useObjectivesStore((s) => s.objectives);
  const moveObjective = useObjectivesStore((s) => s.moveObjective);
  const upsertColumn = useObjectivesStore((s) => s.upsertColumn);
  const removeColumn = useObjectivesStore((s) => s.removeColumn);
  const removeObjective = useObjectivesStore((s) => s.removeObjective);
  const workspacePages = useWorkspaceStore((s) => s.pages);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Objective | null>(null);
  const [draft, setDraft] = useState<Partial<Objective>>({});
  const [pagePickerOpen, setPagePickerOpen] = useState(false);
  const [sprintFilter, setSprintFilter] = useState<string>("all");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const sprintsQuery = useQuery({ queryKey: ["sprints"], queryFn: listSprints });
  const sprints = sprintsQuery.data ?? [];
  const teamQuery = useQuery({ queryKey: ["team-users"], queryFn: listTeamUsers });
  const teamUsers = teamQuery.data ?? [];

  const createSprintMutation = useMutation({
    mutationFn: (name: string) => {
      const start = new Date();
      const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
      const toIso = (d: Date) => d.toISOString().slice(0, 10);
      return createSprint({ name, startDate: toIso(start), endDate: toIso(end) });
    },
    onSuccess: (sprint) => {
      queryClient.setQueryData<typeof sprints>(["sprints"], (current) => [...(current ?? []), sprint]);
      setSprintFilter(sprint.id);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, columnId, order }: { id: string; columnId: string; order: number }) =>
      updateObjective(id, { columnId, order }),
    onError: (error: Error) => toast.error(error.message),
  });

  const createColumnMutation = useMutation({
    mutationFn: (title: string) => createObjectiveColumn(title),
    onSuccess: (column) => upsertColumn(column),
    onError: (error: Error) => toast.error(error.message),
  });

  const renameColumnMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => updateObjectiveColumn(id, { title }),
    onSuccess: (column) => upsertColumn(column),
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (id: string) => deleteObjectiveColumn(id),
    onSuccess: (_void, id) => {
      removeColumn(id);
      queryClient.invalidateQueries({ queryKey: ["objectives"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleDoneMutation = useMutation({
    mutationFn: ({ id, isDone }: { id: string; isDone: boolean }) => updateObjectiveColumn(id, { isDone }),
    onSuccess: (column) => upsertColumn(column),
    onError: (error: Error) => toast.error(error.message),
  });

  const createObjectiveMutation = useMutation({
    mutationFn: (columnId: string) => createObjective({ columnId, title: "Novo objetivo" }),
    onSuccess: (objective) => {
      queryClient.setQueryData<Objective[]>(["objectives"], (current) => [...(current ?? []), objective]);
      setSelected(objective);
      setDraft(objective);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateObjectiveMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Objective> }) => updateObjective(id, patch),
    onSuccess: () => {
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["objectives"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteObjectiveMutation = useMutation({
    mutationFn: (id: string) => deleteObjective(id),
    onSuccess: (_void, id) => {
      removeObjective(id);
      setSelected(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const linkPageMutation = useMutation({
    mutationFn: ({ id, linkedPageId }: { id: string; linkedPageId: string | null }) =>
      updateObjective(id, { linkedPageId }),
    onSuccess: (objective) => {
      setSelected(objective);
      setDraft(objective);
      queryClient.invalidateQueries({ queryKey: ["objectives"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function onDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const overId = e.over?.id as string | undefined;
    const id = e.active.id as string;
    if (!overId || !columns.some((c) => c.id === overId)) return;

    const order = objectives.filter((o) => o.columnId === overId && o.id !== id).length;
    moveObjective(id, overId, order);
    moveMutation.mutate({ id, columnId: overId, order });
  }

  const sorted = [...columns].sort((a, b) => a.order - b.order);
  const visibleObjectives =
    sprintFilter === "all" ? objectives : objectives.filter((o) => o.sprintId === sprintFilter);
  const activeObjective = activeId ? visibleObjectives.find((o) => o.id === activeId) : null;

  const assigneeNameById = Object.fromEntries(
    teamUsers.map((user) => [user.id, user.name || user.username || user.id]),
  );
  const sprintNameById = Object.fromEntries(sprints.map((sprint) => [sprint.id, sprint.name]));

  function openDetail(objective: Objective) {
    setSelected(objective);
    setDraft(objective);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col p-6 gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Objetivos</h1>
          <p className="text-sm text-muted-foreground">Metas e OKRs da equipe.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={sprintFilter}
            onValueChange={(value) => {
              if (value === "new") {
                const name = window.prompt("Nome da sprint (ex: Semana de 08 a 14/09)");
                if (name) createSprintMutation.mutate(name);
                return;
              }
              setSprintFilter(value);
            }}
          >
            <SelectTrigger className="h-9 w-52">
              <SelectValue placeholder="Todas as sprints" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as sprints</SelectItem>
              {sprints.map((sprint) => (
                <SelectItem key={sprint.id} value={sprint.id}>
                  {sprint.name}
                </SelectItem>
              ))}
              <SelectItem value="new">+ Nova sprint</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const title = window.prompt("Nome da coluna");
              if (title) createColumnMutation.mutate(title);
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Nova coluna
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex flex-1 min-h-0 gap-3 overflow-x-auto pb-2">
          {sorted.map((column) => (
            <div key={column.id} className="flex h-full flex-col gap-2">
              <ObjectiveColumn
                column={column}
                objectives={visibleObjectives
                  .filter((o) => o.columnId === column.id)
                  .sort((a, b) => a.order - b.order)}
                onRename={(id, title) => renameColumnMutation.mutate({ id, title })}
                onDelete={(id) => deleteColumnMutation.mutate(id)}
                onToggleDone={(id, isDone) => toggleDoneMutation.mutate({ id, isDone })}
                onOpenObjective={openDetail}
                assigneeNameById={assigneeNameById}
                sprintNameById={sprintNameById}
              />
              <button
                onClick={() => createObjectiveMutation.mutate(column.id)}
                className="flex items-center justify-center gap-1 rounded-md border border-dashed border-border py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40"
              >
                <Plus className="h-3 w-3" /> Novo objetivo
              </button>
            </div>
          ))}
        </div>

        <DragOverlay>
          {activeObjective && (
            <ObjectiveCard
              objective={activeObjective}
              overlay
              assigneeName={activeObjective.assignedUserId ? assigneeNameById[activeObjective.assignedUserId] : null}
              sprintName={activeObjective.sprintId ? sprintNameById[activeObjective.sprintId] : null}
            />
          )}
        </DragOverlay>
      </DndContext>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Editar objetivo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Título</Label>
              <Input value={draft.title ?? ""} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Textarea
                rows={3}
                value={draft.description ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Responsável</Label>
                <Select
                  value={draft.assignedUserId ?? "none"}
                  onValueChange={(value) =>
                    setDraft((d) => ({ ...d, assignedUserId: value === "none" ? null : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ninguém" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguém</SelectItem>
                    {teamUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.username || user.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prazo</Label>
                <Input
                  type="date"
                  value={draft.dueDate ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value || null }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sprint</Label>
              <Select
                value={draft.sprintId ?? "none"}
                onValueChange={(value) => setDraft((d) => ({ ...d, sprintId: value === "none" ? null : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {sprints.map((sprint) => (
                    <SelectItem key={sprint.id} value={sprint.id}>
                      {sprint.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Progresso</Label>
                <span className="text-xs text-muted-foreground">{draft.progress ?? 0}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={draft.progress ?? 0}
                onChange={(e) => setDraft((d) => ({ ...d, progress: Number(e.target.value) }))}
                className="w-full"
              />
              <Progress value={draft.progress ?? 0} className="h-1.5" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Página vinculada</Label>
              {selected?.linkedPageId ? (
                <button
                  onClick={() =>
                    navigate({ to: "/workspace", search: { pageId: selected.linkedPageId! } })
                  }
                  className="group/chip flex w-fit items-center gap-1.5 rounded-full border border-border bg-accent/40 px-2.5 py-1 text-xs hover:border-primary/40"
                >
                  <Link2 className="h-3 w-3 text-primary" />
                  {workspacePages[selected.linkedPageId]?.title || "Página do Workspace"}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      linkPageMutation.mutate({ id: selected.id, linkedPageId: null });
                    }}
                    className="grid h-3.5 w-3.5 place-items-center rounded-full opacity-0 group-hover/chip:opacity-100 hover:bg-muted"
                  >
                    <X className="h-2.5 w-2.5" />
                  </span>
                </button>
              ) : (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPagePickerOpen(true)}>
                  <Link2 className="mr-1 h-3.5 w-3.5" />
                  Vincular página
                </Button>
              )}
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => selected && deleteObjectiveMutation.mutate(selected.id)}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Excluir
            </Button>
            <Button
              size="sm"
              onClick={() =>
                selected &&
                updateObjectiveMutation.mutate({
                  id: selected.id,
                  patch: {
                    title: draft.title,
                    description: draft.description,
                    dueDate: draft.dueDate,
                    progress: draft.progress,
                    assignedUserId: draft.assignedUserId,
                    sprintId: draft.sprintId,
                  },
                })
              }
              disabled={updateObjectiveMutation.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WorkspacePagePicker
        open={pagePickerOpen}
        onOpenChange={setPagePickerOpen}
        onSelect={(pageId) => {
          if (selected) linkPageMutation.mutate({ id: selected.id, linkedPageId: pageId });
          setPagePickerOpen(false);
        }}
      />
    </div>
  );
}
