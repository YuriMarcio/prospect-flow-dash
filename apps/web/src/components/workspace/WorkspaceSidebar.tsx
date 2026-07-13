import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  Folder,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace";
import type { WorkspacePage } from "@/lib/workspaceTypes";

/** id especial do droppable que representa "soltar de volta na raiz" (tira do grupo atual). */
const ROOT_DROP_ID = "__workspace_root__";

interface TreeActions {
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onStartRename: (id: string, title: string) => void;
  onRenameChange: (v: string) => void;
  onCommitRename: (id: string) => void;
  onCancelRename: () => void;
  onNewPage: (parentId: string, icon?: string) => void;
  onDuplicate: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}

export function WorkspaceSidebar({
  activeId,
  onSelect,
  onOpenSearch,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  onOpenSearch: () => void;
}) {
  const pages = useWorkspaceStore((s) => s.pages);
  const createPage = useWorkspaceStore((s) => s.createPage);
  const deletePage = useWorkspaceStore((s) => s.deletePage);
  const duplicatePage = useWorkspaceStore((s) => s.duplicatePage);
  const toggleFavorite = useWorkspaceStore((s) => s.toggleFavorite);
  const updatePageMeta = useWorkspaceStore((s) => s.updatePageMeta);
  const movePage = useWorkspaceStore((s) => s.movePage);

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(Object.keys(pages)));
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isDraggingAny, setIsDraggingAny] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const list = Object.values(pages);
  const favorites = useMemo(() => list.filter((p) => p.favorite).sort((a, b) => a.title.localeCompare(b.title)), [list]);
  const roots = useMemo(
    () => list.filter((p) => p.parentId === null).sort((a, b) => a.order - b.order),
    [list],
  );

  const term = search.trim().toLowerCase();
  const matchesSearch = (p: WorkspacePage) => !term || p.title.toLowerCase().includes(term);
  const hasMatchingDescendant = (p: WorkspacePage): boolean => {
    if (matchesSearch(p)) return true;
    return list.filter((c) => c.parentId === p.id).some(hasMatchingDescendant);
  };

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleNewPage(parentId: string | null, icon = "📄") {
    const id = createPage(parentId, "", icon);
    if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
    onSelect(id);
    setRenamingId(id);
    setRenameValue("");
  }

  function commitRename(id: string) {
    updatePageMeta(id, { title: renameValue.trim() });
    setRenamingId(null);
  }

  function handleDelete(id: string) {
    if (activeId === id) onSelect("");
    deletePage(id);
  }

  function handleDragEnd(e: DragEndEvent) {
    setIsDraggingAny(false);
    const overId = e.over?.id as string | undefined;
    const draggedId = e.active.id as string;
    if (!overId || overId === draggedId) return;

    if (overId === ROOT_DROP_ID) {
      movePage(draggedId, null);
      return;
    }
    movePage(draggedId, overId);
    setExpanded((prev) => new Set(prev).add(overId));
  }

  const actions: TreeActions = {
    onSelect,
    onToggleExpand: toggleExpand,
    onStartRename: (id, title) => {
      setRenamingId(id);
      setRenameValue(title);
    },
    onRenameChange: setRenameValue,
    onCommitRename: commitRename,
    onCancelRename: () => setRenamingId(null),
    onNewPage: handleNewPage,
    onDuplicate: duplicatePage,
    onToggleFavorite: toggleFavorite,
    onDelete: handleDelete,
  };

  return (
    <aside className="w-[260px] shrink-0 flex flex-col border-r border-sidebar-border bg-sidebar/40">
      <div className="flex items-center justify-between px-3 pt-4 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Workspace</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-5 w-5 grid place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Adicionar"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleNewPage(null, "📄")}>
              <FileText className="h-3.5 w-3.5" />
              Nova página
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNewPage(null, "📁")}>
              <Folder className="h-3.5 w-3.5" />
              Novo grupo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="px-3 pb-3 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" className="justify-start" onClick={() => handleNewPage(null, "📄")}>
          <Plus className="h-3.5 w-3.5" />
          Página
        </Button>
        <Button variant="outline" size="sm" className="justify-start" onClick={() => handleNewPage(null, "📁")}>
          <Folder className="h-3.5 w-3.5" />
          Grupo
        </Button>
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center gap-2 rounded-md border border-border bg-background/50 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent/40 transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          Buscar páginas…
          <kbd className="ml-auto text-[10px] border border-border rounded px-1">⌘K</kbd>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
        {favorites.length > 0 && (
          <div>
            <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Favoritos
            </p>
            <div className="space-y-0.5">
              {favorites.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-md px-2 py-1 text-sm text-left transition-colors",
                    activeId === p.id ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent/50",
                  )}
                >
                  <Star className="h-3 w-3 text-warning fill-warning shrink-0" />
                  <span className="truncate">{p.title || "Sem título"}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Páginas</p>
          <DndContext
            id="workspace-page-tree"
            sensors={sensors}
            onDragStart={() => setIsDraggingAny(true)}
            onDragCancel={() => setIsDraggingAny(false)}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-0.5">
              {roots.map((p) => (
                <PageTreeNode
                  key={p.id}
                  page={p}
                  depth={0}
                  list={list}
                  activeId={activeId}
                  expanded={expanded}
                  term={term}
                  hasMatchingDescendant={hasMatchingDescendant}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  actions={actions}
                />
              ))}
            </div>
            <RootDropZone active={isDraggingAny} />
          </DndContext>
        </div>
      </div>
    </aside>
  );
}

/**
 * Área de soltar dedicada pra tirar uma página de dentro de um grupo e
 * devolvê-la pro nível raiz — sem isso, só dá pra soltar EM CIMA de outra
 * página (o que sempre reparenta como filha dela).
 */
function RootDropZone({ active }: { active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT_DROP_ID });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md border border-dashed transition-all flex items-center justify-center text-[11px]",
        active
          ? "mt-2 h-10 opacity-100"
          : "h-0 opacity-0 pointer-events-none overflow-hidden border-transparent",
        isOver
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground",
      )}
    >
      Soltar aqui para tirar do grupo
    </div>
  );
}

function PageTreeNode({
  page,
  depth,
  list,
  activeId,
  expanded,
  term,
  hasMatchingDescendant,
  renamingId,
  renameValue,
  actions,
}: {
  page: WorkspacePage;
  depth: number;
  list: WorkspacePage[];
  activeId: string | null;
  expanded: Set<string>;
  term: string;
  hasMatchingDescendant: (p: WorkspacePage) => boolean;
  renamingId: string | null;
  renameValue: string;
  actions: TreeActions;
}) {
  const children = list.filter((c) => c.parentId === page.id).sort((a, b) => a.order - b.order);
  if (term && !hasMatchingDescendant(page)) return null;

  const isExpanded = expanded.has(page.id) || Boolean(term);
  const isActive = activeId === page.id;
  const isRenaming = renamingId === page.id;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: page.id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: page.id });

  return (
    <div>
      <div
        ref={setDropRef}
        tabIndex={0}
        className={cn(
          "group flex items-center gap-1 rounded-md pr-1 py-1 text-sm cursor-pointer transition-colors outline-none",
          isActive ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent/50",
          isOver && "ring-1 ring-primary bg-primary/10",
          isDragging && "opacity-40",
        )}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={(e) => {
          if (isRenaming) return;
          // Clicar num filho (o <span> do título, por ex.) não move o foco de
          // teclado pro ancestral com tabIndex — sem isso, Delete/Backspace
          // nunca chegam ao onKeyDown abaixo.
          e.currentTarget.focus();
          actions.onSelect(page.id);
        }}
        onKeyDown={(e) => {
          if ((e.key === "Delete" || e.key === "Backspace") && !isRenaming) {
            e.preventDefault();
            actions.onDelete(page.id);
          }
        }}
      >
        {/*
          O "pegador" de arrastar fica isolado num elemento próprio — não na
          linha inteira — porque {...listeners} do dnd-kit inclui
          onPointerDown, e isso bagunçava o cálculo de posição do Radix
          Popper pros menus "+"/"..." quando eles eram descendentes do mesmo
          nó observado pelo dnd-kit (o menu abria certo, mas só depois de um
          reposicionamento tardio — daí parecer certo no fade-out e errado no
          fade-in).
        */}
        <span
          ref={setDragRef}
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 shrink-0 grid place-items-center cursor-grab text-transparent group-hover:text-muted-foreground/60 hover:text-foreground"
        >
          <GripVertical className="h-3 w-3" />
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            actions.onToggleExpand(page.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn("h-4 w-4 shrink-0 grid place-items-center", children.length === 0 && "invisible")}
        >
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <span className="text-sm shrink-0 leading-none">{page.icon}</span>

        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => actions.onRenameChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") actions.onCommitRename(page.id);
              if (e.key === "Escape") actions.onCancelRename();
            }}
            onBlur={() => actions.onCommitRename(page.id)}
            className="flex-1 min-w-0 bg-transparent border-b border-primary text-sm outline-none"
            placeholder="Sem título"
          />
        ) : (
          <span className={cn("truncate flex-1", !page.title && "italic text-muted-foreground/70")}>
            {page.title || "Sem título"}
          </span>
        )}

        {!isRenaming && (
          <div className="flex items-center gap-0.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  title="Adicionar dentro"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="h-5 w-5 grid place-items-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => actions.onNewPage(page.id, "📄")}>
                  <FileText className="h-3.5 w-3.5" />
                  Nova subpágina
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.onNewPage(page.id, "📁")}>
                  <Folder className="h-3.5 w-3.5" />
                  Novo grupo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="h-5 w-5 grid place-items-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => actions.onStartRename(page.id, page.title)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Renomear
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.onDuplicate(page.id)}>
                  <Copy className="h-3.5 w-3.5" />
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.onToggleFavorite(page.id)}>
                  <Star className="h-3.5 w-3.5" />
                  {page.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => actions.onDelete(page.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      {isExpanded &&
        children.map((c) => (
          <PageTreeNode
            key={c.id}
            page={c}
            depth={depth + 1}
            list={list}
            activeId={activeId}
            expanded={expanded}
            term={term}
            hasMatchingDescendant={hasMatchingDescendant}
            renamingId={renamingId}
            renameValue={renameValue}
            actions={actions}
          />
        ))}
    </div>
  );
}
