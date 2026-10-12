import { useMemo, useState, type ReactNode } from "react";
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
import { Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useObjectivesStore } from "@/store/objectives";
import { useObjectivesSync } from "@/hooks/use-objectives-sync";
import { useWorkspaceStore } from "@/store/workspace";
import { useWorkspaceSync } from "@/hooks/use-workspace-sync";
import { ObjectiveColumn } from "@/components/objectives/ObjectiveColumn";
import { ObjectiveCard } from "@/components/objectives/ObjectiveCard";
import { ObjectiveDrawer } from "@/components/objectives/ObjectiveDrawer";
import { ObjectiveFormDialog, type ObjectiveFormValues } from "@/components/objectives/ObjectiveFormDialog";
import { ObjectiveStats } from "@/components/objectives/ObjectiveStats";
import { SprintDialog, type SprintFormValues } from "@/components/objectives/SprintDialog";
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
  updateSprint,
  type Objective,
  type ObjectiveArea,
  type Sprint,
} from "@/lib/objectives";
import { OBJECTIVE_AREAS, sprintLabel } from "@/lib/objectiveMeta";
import {
  averageProgress,
  buildChildrenMap,
  buildMilestoneStats,
  collectSubtreeIds,
  isDone,
} from "@/lib/objectiveTree";

type FormState = { mode: "create"; columnId: string } | { mode: "edit" } | null;

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
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(null);
  const [sprintDialog, setSprintDialog] = useState<{ open: boolean; sprint: Sprint | null }>({
    open: false,
    sprint: null,
  });
  const [pagePickerOpen, setPagePickerOpen] = useState(false);
  const [sprintFilter, setSprintFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<"all" | ObjectiveArea>("all");
  const [search, setSearch] = useState("");
  const [mobileColumnId, setMobileColumnId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const sprintsQuery = useQuery({ queryKey: ["sprints"], queryFn: listSprints });
  const sprints = sprintsQuery.data ?? [];
  const teamQuery = useQuery({ queryKey: ["team-users"], queryFn: listTeamUsers });
  const teamUsers = teamQuery.data ?? [];

  // O cache de ["objectives"] é a fonte: a store é espelho dele (useObjectivesSync). Escrever nele e
  // depois revalidar mantém a tela instantânea e deixa o servidor recalcular o progresso da árvore.
  function patchObjectivesCache(update: (current: Objective[]) => Objective[]) {
    queryClient.setQueryData<Objective[]>(["objectives"], (current) => (current ? update(current) : current));
  }
  const revalidateObjectives = () => queryClient.invalidateQueries({ queryKey: ["objectives"] });

  const saveSprintMutation = useMutation({
    mutationFn: ({ id, values }: { id: string | null; values: SprintFormValues }) =>
      id ? updateSprint(id, values) : createSprint(values),
    onSuccess: (sprint, { id }) => {
      queryClient.setQueryData<Sprint[]>(["sprints"], (current) =>
        id ? (current ?? []).map((s) => (s.id === sprint.id ? sprint : s)) : [...(current ?? []), sprint],
      );
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
      if (!id) setSprintFilter(sprint.id);
      setSprintDialog({ open: false, sprint: null });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, columnId, order }: { id: string; columnId: string; order: number }) =>
      updateObjective(id, { columnId, order }),
    onMutate: ({ id, columnId, order }) =>
      patchObjectivesCache((current) => current.map((o) => (o.id === id ? { ...o, columnId, order } : o))),
    onError: (error: Error) => {
      toast.error(error.message);
      revalidateObjectives();
    },
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
      revalidateObjectives();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleDoneMutation = useMutation({
    mutationFn: ({ id, isDone }: { id: string; isDone: boolean }) => updateObjectiveColumn(id, { isDone }),
    onSuccess: (column) => upsertColumn(column),
    onError: (error: Error) => toast.error(error.message),
  });

  const createObjectiveMutation = useMutation({
    mutationFn: (values: ObjectiveFormValues) =>
      createObjective({
        columnId: values.columnId,
        title: values.title,
        description: values.description,
        area: values.area,
        priority: values.priority,
        dueDate: values.dueDate,
        assignedUserId: values.assignedUserId,
        sprintId: values.sprintId,
      }),
    onSuccess: (objective) => {
      patchObjectivesCache((current) => [...current, objective]);
      setFormState(null);
      // Abre o detalhe já pra quebrar o objetivo em marcos.
      setDetailId(objective.id);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateObjectiveMutation = useMutation({
    mutationFn: ({ objective, values }: { objective: Objective; values: ObjectiveFormValues }) => {
      const patch: Parameters<typeof updateObjective>[1] = {
        title: values.title,
        description: values.description,
        area: values.area,
        priority: values.priority,
        dueDate: values.dueDate,
        assignedUserId: values.assignedUserId,
        sprintId: values.sprintId,
      };
      if (values.columnId !== objective.columnId) {
        patch.columnId = values.columnId;
        patch.order = objectives.filter((o) => o.columnId === values.columnId && o.id !== objective.id).length;
      }
      // Com marcos o progresso é derivado deles — só vale o slider sem marcos.
      if (!childrenMap.has(objective.id)) patch.progress = values.progress;
      return updateObjective(objective.id, patch);
    },
    onSuccess: (updated) => {
      patchObjectivesCache((current) => current.map((o) => (o.id === updated.id ? updated : o)));
      setFormState(null);
      revalidateObjectives();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteObjectiveMutation = useMutation({
    mutationFn: (id: string) => deleteObjective(id),
    onSuccess: (_void, id) => {
      removeObjective(id);
      patchObjectivesCache((current) => {
        const removed = collectSubtreeIds(current, id);
        return current.filter((o) => !removed.has(o.id));
      });
      setFormState(null);
      setDetailId(null);
      revalidateObjectives();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const linkPageMutation = useMutation({
    mutationFn: ({ id, linkedPageId }: { id: string; linkedPageId: string | null }) =>
      updateObjective(id, { linkedPageId }),
    onSuccess: (objective) => {
      patchObjectivesCache((current) => current.map((o) => (o.id === objective.id ? objective : o)));
      revalidateObjectives();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Marcos, issues e subissues são todos "filhos": mesma criação/edição/exclusão em qualquer nível.
  const createChildMutation = useMutation({
    mutationFn: ({ parentId, title }: { parentId: string; title: string }) =>
      createObjective({ title, kind: "task", parentObjectiveId: parentId }),
    onSuccess: (child) => {
      patchObjectivesCache((current) => [...current, child]);
      revalidateObjectives();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateChildMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { title?: string; progress?: number } }) =>
      updateObjective(id, patch),
    onMutate: ({ id, patch }) =>
      patchObjectivesCache((current) => current.map((o) => (o.id === id ? { ...o, ...patch } : o))),
    onError: (error: Error) => toast.error(error.message),
    // No erro, a revalidação também desfaz a atualização otimista.
    onSettled: revalidateObjectives,
  });

  const deleteChildMutation = useMutation({
    mutationFn: (id: string) => deleteObjective(id),
    onSuccess: (_void, id) => {
      patchObjectivesCache((current) => {
        const removed = collectSubtreeIds(current, id);
        return current.filter((o) => !removed.has(o.id));
      });
      revalidateObjectives();
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
  const roots = useMemo(() => objectives.filter((o) => !o.parentObjectiveId), [objectives]);
  const childrenMap = useMemo(() => buildChildrenMap(objectives), [objectives]);
  const milestoneStatsById = useMemo(() => buildMilestoneStats(roots, childrenMap), [roots, childrenMap]);
  const childrenOf = (id: string) => childrenMap.get(id) ?? [];

  const query = search.trim().toLowerCase();
  const visibleObjectives = roots.filter(
    (o) =>
      (sprintFilter === "all" || o.sprintId === sprintFilter) &&
      (areaFilter === "all" || o.area === areaFilter) &&
      (!query || o.title.toLowerCase().includes(query) || o.description.toLowerCase().includes(query)),
  );
  const activeObjective = activeId ? visibleObjectives.find((o) => o.id === activeId) : null;
  const activeMobileColumnId = mobileColumnId ?? sorted[0]?.id ?? null;
  const detail = detailId ? (objectives.find((o) => o.id === detailId) ?? null) : null;

  // "Em andamento" = fora da primeira coluna (backlog) e fora das colunas de concluído.
  const doneColumnIds = new Set(columns.filter((c) => c.isDone).map((c) => c.id));
  const milestones = visibleObjectives.flatMap((o) => childrenOf(o.id));
  const stats = {
    total: visibleObjectives.length,
    inProgress: visibleObjectives.filter(
      (o) => o.columnId && o.columnId !== sorted[0]?.id && !doneColumnIds.has(o.columnId),
    ).length,
    milestonesDone: milestones.filter(isDone).length,
    milestonesTotal: milestones.length,
    milestoneAverage: averageProgress(milestones),
  };

  const assigneeNameById = Object.fromEntries(
    teamUsers.map((user) => [user.id, user.name || user.username || user.id]),
  );
  const sprintById = Object.fromEntries(sprints.map((sprint) => [sprint.id, sprint]));
  const sprintNameById = Object.fromEntries(sprints.map((sprint) => [sprint.id, sprint.name]));
  const filteredSprint = sprintFilter === "all" ? null : (sprintById[sprintFilter] ?? null);

  function openCreate(columnId?: string | null) {
    const target = columnId ?? sorted[0]?.id;
    if (!target) {
      toast.error("Crie uma coluna antes de adicionar objetivos.");
      return;
    }
    setFormState({ mode: "create", columnId: target });
  }

  function changeColumn(objective: Objective, columnId: string) {
    if (columnId === objective.columnId) return;
    const order = objectives.filter((o) => o.columnId === columnId && o.id !== objective.id).length;
    moveObjective(objective.id, columnId, order);
    moveMutation.mutate({ id: objective.id, columnId, order });
  }

  function handleDeleteChild(node: Objective) {
    if (childrenMap.has(node.id) && !window.confirm(`Excluir "${node.title}" e tudo que está dentro dele?`)) return;
    deleteChildMutation.mutate(node.id);
  }

  function handleDeleteObjective(objective: Objective) {
    const hasChildren = childrenMap.has(objective.id);
    const message = hasChildren
      ? `Excluir "${objective.title}" e todos os marcos, issues e subissues dele?`
      : `Excluir "${objective.title}"?`;
    if (window.confirm(message)) deleteObjectiveMutation.mutate(objective.id);
  }

  const formObjective = formState?.mode === "edit" ? detail : null;

  return (
    <div className="relative flex h-[calc(100vh-4rem)] flex-col gap-4 overflow-y-auto p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Gestão estratégica</p>
          <h1 className="text-3xl font-bold tracking-tight">Objetivos</h1>
          <p className="text-sm text-muted-foreground">
            Do planejamento à entrega: acompanhe marcos, tarefas e subtarefas de cada área.
          </p>
        </div>
        <Button className="hidden md:inline-flex" onClick={() => openCreate()}>
          <Plus className="mr-1 h-4 w-4" />
          Novo objetivo
        </Button>
      </header>

      <ObjectiveStats stats={stats} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          <AreaChip active={areaFilter === "all"} onClick={() => setAreaFilter("all")}>
            Todas
          </AreaChip>
          {OBJECTIVE_AREAS.map((area) => (
            <AreaChip key={area.value} active={areaFilter === area.value} onClick={() => setAreaFilter(area.value)}>
              <span className={cn("h-2 w-2 rounded-full", area.dot)} />
              {area.label}
            </AreaChip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar objetivo..."
              className="h-9 w-44 pl-8"
            />
          </div>
          <Select value={sprintFilter} onValueChange={setSprintFilter}>
            <SelectTrigger className="h-9 w-48 sm:w-56">
              <SelectValue placeholder="Todas as sprints" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as sprints</SelectItem>
              {sprints.map((sprint) => (
                <SelectItem key={sprint.id} value={sprint.id}>
                  {sprintLabel(sprint)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filteredSprint && (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              aria-label="Editar período da sprint"
              title="Editar nome e período da sprint"
              onClick={() => setSprintDialog({ open: true, sprint: filteredSprint })}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-9" onClick={() => setSprintDialog({ open: true, sprint: null })}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Sprint
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="hidden h-9 md:inline-flex"
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

      <p className="hidden text-xs text-muted-foreground md:block">
        ↗ Arraste os cartões para mudar de etapa, ou clique para abrir os marcos e as issues.
      </p>

      {/* Abas de coluna só no celular — no desktop as colunas já ficam lado a lado */}
      <div className="md:hidden flex items-center gap-4 border-b border-border overflow-x-auto -mx-4 px-4">
        {sorted.map((column) => {
          const count = visibleObjectives.filter((o) => o.columnId === column.id).length;
          const active = column.id === activeMobileColumnId;
          return (
            <button
              key={column.id}
              onClick={() => setMobileColumnId(column.id)}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 pb-2 -mb-px text-sm font-medium transition-colors",
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground",
              )}
            >
              {column.title} ({count})
            </button>
          );
        })}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex min-h-[28rem] flex-1 gap-3 overflow-x-auto pb-2">
          {sorted.map((column) => (
            <div
              key={column.id}
              className={cn(
                "h-full flex-col w-full md:w-auto",
                column.id === activeMobileColumnId ? "flex" : "hidden md:flex",
              )}
            >
              <ObjectiveColumn
                column={column}
                objectives={visibleObjectives
                  .filter((o) => o.columnId === column.id)
                  .sort((a, b) => a.order - b.order)}
                onRename={(id, title) => renameColumnMutation.mutate({ id, title })}
                onDelete={(id) => deleteColumnMutation.mutate(id)}
                onToggleDone={(id, isDone) => toggleDoneMutation.mutate({ id, isDone })}
                onOpenObjective={(objective) => setDetailId(objective.id)}
                onAdd={() => openCreate(column.id)}
                assigneeNameById={assigneeNameById}
                sprintNameById={sprintNameById}
                milestoneStatsById={milestoneStatsById}
              />
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
              milestoneStats={milestoneStatsById[activeObjective.id]}
            />
          )}
        </DragOverlay>
      </DndContext>

      {activeMobileColumnId && (
        <button
          onClick={() => openCreate(activeMobileColumnId)}
          className="md:hidden fixed bottom-6 right-6 z-20 flex items-center gap-2 rounded-full bg-primary pl-4 pr-5 py-3 text-sm font-medium text-primary-foreground shadow-lg active:scale-95 transition-transform"
        >
          <Plus className="h-4 w-4" />
          Novo Objetivo
        </button>
      )}

      <ObjectiveDrawer
        objective={detail}
        onClose={() => setDetailId(null)}
        columns={sorted}
        sprint={detail?.sprintId ? sprintById[detail.sprintId] : null}
        assigneeName={detail?.assignedUserId ? assigneeNameById[detail.assignedUserId] : null}
        linkedPageTitle={detail?.linkedPageId ? workspacePages[detail.linkedPageId]?.title : undefined}
        childrenOf={childrenOf}
        onEdit={() => setFormState({ mode: "edit" })}
        onChangeColumn={(columnId) => detail && changeColumn(detail, columnId)}
        onOpenLinkedPage={() =>
          detail?.linkedPageId && navigate({ to: "/workspace", search: { pageId: detail.linkedPageId } })
        }
        onPickLinkedPage={() => setPagePickerOpen(true)}
        onUnlinkPage={() => detail && linkPageMutation.mutate({ id: detail.id, linkedPageId: null })}
        onCreate={(parentId, title) => createChildMutation.mutate({ parentId, title })}
        onToggle={(node, done) => updateChildMutation.mutate({ id: node.id, patch: { progress: done ? 100 : 0 } })}
        onRename={(node, title) => updateChildMutation.mutate({ id: node.id, patch: { title } })}
        onDelete={handleDeleteChild}
      />

      <ObjectiveFormDialog
        open={formState !== null}
        onOpenChange={(open) => !open && setFormState(null)}
        objective={formObjective}
        defaultColumnId={
          formState?.mode === "create" ? formState.columnId : (detail?.columnId ?? sorted[0]?.id ?? "")
        }
        defaultArea={areaFilter === "all" ? null : areaFilter}
        columns={sorted}
        sprints={sprints}
        teamUsers={teamUsers}
        hasMilestones={Boolean(detail && childrenMap.has(detail.id))}
        submitting={createObjectiveMutation.isPending || updateObjectiveMutation.isPending}
        onSubmit={(values) => {
          if (formState?.mode === "edit" && formObjective) {
            updateObjectiveMutation.mutate({ objective: formObjective, values });
          } else {
            createObjectiveMutation.mutate(values);
          }
        }}
        onDelete={formObjective ? () => handleDeleteObjective(formObjective) : undefined}
      />

      <SprintDialog
        open={sprintDialog.open}
        onOpenChange={(open) => setSprintDialog((current) => ({ ...current, open }))}
        sprint={sprintDialog.sprint}
        suggestedName={`Sprint ${String(sprints.length + 1).padStart(2, "0")}`}
        submitting={saveSprintMutation.isPending}
        onSubmit={(values) => saveSprintMutation.mutate({ id: sprintDialog.sprint?.id ?? null, values })}
      />

      <WorkspacePagePicker
        open={pagePickerOpen}
        onOpenChange={setPagePickerOpen}
        onSelect={(pageId) => {
          if (detail) linkPageMutation.mutate({ id: detail.id, linkedPageId: pageId });
          setPagePickerOpen(false);
        }}
      />
    </div>
  );
}

function AreaChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border bg-card text-foreground hover:border-foreground/30",
      )}
    >
      {children}
    </button>
  );
}
