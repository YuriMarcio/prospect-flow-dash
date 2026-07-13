import { create } from "zustand";

interface VaultAuthState {
  vaultToken: string | null;
  unlockedUntil: number | null;
  setUnlocked: (token: string, expiresAt: number) => void;
  lock: () => void;
  isUnlocked: () => boolean;
}

// Sem persist de propósito: refresh/nova aba deve sempre re-bloquear o cofre.
export const useVaultAuthStore = create<VaultAuthState>()((set, get) => ({
  vaultToken: null,
  unlockedUntil: null,
  setUnlocked: (token, expiresAt) => set({ vaultToken: token, unlockedUntil: expiresAt }),
  lock: () => set({ vaultToken: null, unlockedUntil: null }),
  isUnlocked: () => {
    const { vaultToken, unlockedUntil } = get();
    return Boolean(vaultToken && unlockedUntil && Date.now() < unlockedUntil);
  },
}));
