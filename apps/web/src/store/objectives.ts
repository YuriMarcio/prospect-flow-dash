import { create } from "zustand";
import type { Objective, ObjectiveColumn } from "@/lib/objectives";
import { collectSubtreeIds } from "@/lib/objectiveTree";

interface ObjectivesState {
  columns: ObjectiveColumn[];
  objectives: Objective[];
  setColumns: (columns: ObjectiveColumn[]) => void;
  setObjectives: (objectives: Objective[]) => void;
  moveObjective: (id: string, columnId: string, order: number) => void;
  upsertColumn: (column: ObjectiveColumn) => void;
  removeColumn: (id: string) => void;
  upsertObjective: (objective: Objective) => void;
  removeObjective: (id: string) => void;
}

export const useObjectivesStore = create<ObjectivesState>()((set) => ({
  columns: [],
  objectives: [],

  setColumns: (columns) => set({ columns }),
  setObjectives: (objectives) => set({ objectives }),

  moveObjective: (id, columnId, order) =>
    set((s) => ({
      objectives: s.objectives.map((o) => (o.id === id ? { ...o, columnId, order } : o)),
    })),

  upsertColumn: (column) =>
    set((s) => {
      const exists = s.columns.some((c) => c.id === column.id);
      return {
        columns: exists ? s.columns.map((c) => (c.id === column.id ? column : c)) : [...s.columns, column],
      };
    }),

  removeColumn: (id) => set((s) => ({ columns: s.columns.filter((c) => c.id !== id) })),

  upsertObjective: (objective) =>
    set((s) => {
      const exists = s.objectives.some((o) => o.id === objective.id);
      return {
        objectives: exists
          ? s.objectives.map((o) => (o.id === objective.id ? objective : o))
          : [...s.objectives, objective],
      };
    }),

  // Excluir um item leva marcos, issues e subissues dele junto (o servidor faz o mesmo).
  removeObjective: (id) =>
    set((s) => {
      const removed = collectSubtreeIds(s.objectives, id);
      return { objectives: s.objectives.filter((o) => !removed.has(o.id)) };
    }),
}));
