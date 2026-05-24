import { useState } from "react";
import {
  DndContext, DragOverlay, type DragEndEvent, type DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { useKanbanStore } from "@/store/kanban";
import { useFiltersStore } from "@/store/filters";
import { KanbanColumn } from "@/components/KanbanColumn";
import { LeadCard } from "@/components/LeadCard";

export function KanbanPage() {
  const { columns, leads, moveLead, addColumn } = useKanbanStore();
  const search = useFiltersStore((s) => s.search);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const filtered = leads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.companyName.toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      l.instagram?.toLowerCase().includes(q) ||
      l.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const onDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const overId = e.over?.id as string | undefined;
    const id = e.active.id as string;
    if (overId && columns.some((c) => c.id === overId)) moveLead(id, overId);
  };
  const onDragCancel = () => setActiveId(null);

  const sorted = [...columns].sort((a, b) => a.order - b.order);
  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline Comercial</h1>
          <p className="text-sm text-muted-foreground mt-1">Arraste leads entre as colunas para atualizar o pipeline.</p>
        </div>
        <button
          onClick={() => { const t = prompt("Nome da nova coluna"); if (t) addColumn(t); }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition glow-primary"
        >
          <Plus className="h-4 w-4" /> Nova coluna
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className={`flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 ${activeId ? "cursor-grabbing" : ""}`}>
          {sorted.map((col) => (
            <KanbanColumn key={col.id} column={col} leads={filtered.filter((l) => l.columnId === col.id)} />
          ))}
          <button
            onClick={() => { const t = prompt("Nome da nova coluna"); if (t) addColumn(t); }}
            className="w-72 shrink-0 h-32 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition"
          >
            + Adicionar coluna
          </button>
        </div>

        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
          {activeLead ? (
            <div className="w-72">
              <LeadCard lead={activeLead} overlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
