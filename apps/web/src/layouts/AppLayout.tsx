import { Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MobileSidebar } from "@/components/MobileSidebar";
import { Header } from "@/components/Header";
import { useThemeStore } from "@/store/theme";

export function AppLayout() {
  const apply = useThemeStore((s) => s.apply);
  useEffect(() => { apply(); }, [apply]);

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
