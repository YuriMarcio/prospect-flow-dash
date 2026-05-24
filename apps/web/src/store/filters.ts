import { create } from "zustand";

interface FiltersState {
  search: string;
  city: string;
  category: string;
  status: string;
  owner: string;
  minScore: number;
  setSearch: (v: string) => void;
  setFilter: (key: "city" | "category" | "status" | "owner", v: string) => void;
  setMinScore: (n: number) => void;
  reset: () => void;
}

export const useFiltersStore = create<FiltersState>((set) => ({
  search: "",
  city: "",
  category: "",
  status: "",
  owner: "",
  minScore: 0,
  setSearch: (v) => set({ search: v }),
  setFilter: (key, v) => set({ [key]: v } as any),
  setMinScore: (n) => set({ minScore: n }),
  reset: () => set({ search: "", city: "", category: "", status: "", owner: "", minScore: 0 }),
}));
