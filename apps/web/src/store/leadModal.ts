import { create } from "zustand";

interface LeadModalState {
  leadId: string | null;
  open: (id: string) => void;
  close: () => void;
}

export const useLeadModalStore = create<LeadModalState>((set) => ({
  leadId: null,
  open: (id) => set({ leadId: id }),
  close: () => set({ leadId: null }),
}));
