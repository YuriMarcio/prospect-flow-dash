import { create } from "zustand";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaInstallStore {
  deferredPrompt: BeforeInstallPromptEvent | null;
  setDeferredPrompt: (event: BeforeInstallPromptEvent | null) => void;
}

export const usePwaInstallStore = create<PwaInstallStore>((set) => ({
  deferredPrompt: null,
  setDeferredPrompt: (deferredPrompt) => set({ deferredPrompt }),
}));

export async function triggerPwaInstall() {
  const { deferredPrompt, setDeferredPrompt } = usePwaInstallStore.getState();
  if (!deferredPrompt) return;
  await deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  // O navegador só permite chamar prompt() uma vez por evento capturado.
  setDeferredPrompt(null);
}
