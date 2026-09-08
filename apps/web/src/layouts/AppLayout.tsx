import { Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MobileSidebar } from "@/components/MobileSidebar";
import { Header } from "@/components/Header";
import { useThemeStore } from "@/store/theme";
import { usePwaInstallStore } from "@/store/pwaInstall";

export function AppLayout() {
  const apply = useThemeStore((s) => s.apply);
  useEffect(() => { apply(); }, [apply]);

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
    <div className="flex h-screen overflow-hidden w-full bg-background text-foreground">
      <Sidebar />
      <MobileSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
