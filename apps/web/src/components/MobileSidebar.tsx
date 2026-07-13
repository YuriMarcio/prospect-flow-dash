import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, KanbanSquare, CalendarClock, Bot, Download, BarChart3, Settings, Sparkles, Lock, NotebookText, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMobileSidebarStore } from "@/store/mobileSidebar";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/kanban", label: "Kanban", icon: KanbanSquare },
  { to: "/agenda", label: "Agenda", icon: CalendarClock },
  { to: "/automacao", label: "Automação", icon: Bot },
  { to: "/capturas", label: "Capturas", icon: Download },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/workspace", label: "Workspace", icon: NotebookText },
  { to: "/senhas", label: "Senhas", icon: Lock },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function MobileSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { open, setOpen } = useMobileSidebarStore();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-[280px] p-0 bg-sidebar border-r border-sidebar-border">
        <SheetHeader className="sr-only">
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Navegação principal</SheetDescription>
        </SheetHeader>
        <div className="flex h-16 items-center gap-2 px-5 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">ProspectAI</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">CRM Cold Call</span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {items.map((it) => {
            const active = pathname === it.to;
            return (
              <Link
                key={it.to}
                to={it.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-accent text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <it.icon className={cn("h-4 w-4 transition-colors", active && "text-primary")} />
                {it.label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
