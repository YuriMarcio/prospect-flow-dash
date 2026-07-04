import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@/lib/api";

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  displayName: string | null;
  setAuthenticated: (user: AuthUser) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      username: null,
      displayName: null,
      setAuthenticated: (user) =>
        set({
          isAuthenticated: true,
          username: user.username,
          displayName: user.name ?? user.username ?? user.email,
        }),
      clear: () => set({ isAuthenticated: false, username: null, displayName: null }),
    }),
    { name: "crm-auth" },
  ),
);
