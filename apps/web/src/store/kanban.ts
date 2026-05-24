import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultColumns, mockLeads } from "@/mock/data";
import type { KanbanColumn, Lead } from "@/types";

interface KanbanState {
  columns: KanbanColumn[];
  leads: Lead[];
  moveLead: (leadId: string, toColumnId: string) => void;
  addColumn: (title: string) => void;
  updateColumn: (id: string, patch: Partial<KanbanColumn>) => void;
  deleteColumn: (id: string) => void;
  reorderColumns: (ids: string[]) => void;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  addLead: (lead: Lead) => void;
}

export const useKanbanStore = create<KanbanState>()(
  persist(
    (set) => ({
      columns: defaultColumns,
      leads: mockLeads,
      moveLead: (leadId, toColumnId) =>
        set((s) => ({
          leads: s.leads.map((l) =>
            l.id === leadId
              ? {
                  ...l,
                  columnId: toColumnId,
                  timeline: [
                    {
                      id: `mv-${Date.now()}`,
                      type: "move",
                      title: `Movido para ${s.columns.find((c) => c.id === toColumnId)?.title ?? "coluna"}`,
                      date: "agora",
                      author: "Você",
                    },
                    ...l.timeline,
                  ],
                }
              : l,
          ),
        })),
      addColumn: (title) =>
        set((s) => ({
          columns: [
            ...s.columns,
            { id: `col-${Date.now()}`, title, color: "oklch(0.7 0.1 260)", order: s.columns.length },
          ],
        })),
      updateColumn: (id, patch) =>
        set((s) => ({ columns: s.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      deleteColumn: (id) =>
        set((s) => ({
          columns: s.columns.filter((c) => c.id !== id),
          leads: s.leads.map((l) => (l.columnId === id ? { ...l, columnId: s.columns[0]?.id ?? "" } : l)),
        })),
      reorderColumns: (ids) =>
        set((s) => ({
          columns: ids.map((id, i) => ({ ...s.columns.find((c) => c.id === id)!, order: i })),
        })),
      updateLead: (id, patch) =>
        set((s) => ({ leads: s.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
      addLead: (lead) => set((s) => ({ leads: [lead, ...s.leads] })),
    }),
    { name: "crm-kanban" },
  ),
);
