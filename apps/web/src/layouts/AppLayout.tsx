import { Outlet, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MobileSidebar } from "@/components/MobileSidebar";
import { Header } from "@/components/Header";
import { PushBootstrap } from "@/components/PushBootstrap";
import { useThemeStore } from "@/store/theme";
import { usePwaInstallStore } from "@/store/pwaInstall";
import { clearReturnPoint, takeReturnPoint } from "@/lib/returnPoint";

export function AppLayout() {
  const apply = useThemeStore((s) => s.apply);
  useEffect(() => { apply(); }, [apply]);

  // Voltou de um link externo (WhatsApp...) e o app reabriu no Dashboard: devolve o usuário à tela de onde saiu.
  // Se a página sobreviveu (voltou a ficar visível), não há o que restaurar.
  const router = useRouter();
  useEffect(() => {
    const target = takeReturnPoint();
    if (target) router.history.replace(target);

    function onVisible() {
      if (document.visibilityState === "visible") clearReturnPoint();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  const setDeferredPrompt = usePwaInstallStore((s) => s.setDeferredPrompt);
  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      // Sem isso o Chrome mostra o próprio mini-infobar de instalação e some;
      // segurando o evento a gente decide quando (e se) mostrar o prompt.
      e.preventDefault();
      setDeferredPrompt(e as Parameters<typeof setDeferredPrompt>[0]);
    }
    function onAppInstalled() {
      setDeferredPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [setDeferredPrompt]);

  return (
    <div className="flex h-dvh overflow-hidden w-full bg-background text-foreground">
      <PushBootstrap />
      <Sidebar />
      <MobileSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 min-w-0 overflow-y-auto overscroll-contain">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
