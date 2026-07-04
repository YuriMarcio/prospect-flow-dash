import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  setAuthenticated: (username: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      username: null,
      setAuthenticated: (username) => set({ isAuthenticated: true, username }),
      clear: () => set({ isAuthenticated: false, username: null }),
    }),
    { name: "crm-auth" },
  ),
);
