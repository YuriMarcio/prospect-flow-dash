import { Bell, Menu, Moon, Search, Sun, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useThemeStore } from "@/store/theme";
import { useFiltersStore } from "@/store/filters";
import { useMobileSidebarStore } from "@/store/mobileSidebar";
import { useLeadModalStore } from "@/store/leadModal";
import { useAuthStore } from "@/store/auth";
import { logout } from "@/lib/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useNotificationsStore,
  isDue,
  formatDueTime,
  formatRelativeTime,
} from "@/store/notifications";

export function Header() {
  const { theme, toggle } = useThemeStore();
  const { search, setSearch } = useFiltersStore();
  const { toggle: toggleMobileSidebar } = useMobileSidebarStore();
  const openLead = useLeadModalStore((s) => s.open);
  const { notifications, markRead, markAllRead, dismiss, snooze } = useNotificationsStore();
  const navigate = useNavigate();
  const displayName = useAuthStore((s) => s.displayName);
  const clearAuth = useAuthStore((s) => s.clear);
  const initials = (displayName ?? "?").slice(0, 2).toUpperCase();

  async function handleLogout() {
    try {
      await logout();
    } finally {
      clearAuth();
      await navigate({ to: "/login" });
    }
  }

  const dueNow = notifications.filter((n) => !n.read && isDue(n));
  const upcoming = notifications.filter((n) => !n.read && !isDue(n));
  const unreadCount = dueNow.length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border glass px-4 md:px-6">
      <button
        onClick={toggleMobileSidebar}
        className="md:hidden p-2 -ml-2 rounded-md hover:bg-accent"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative flex-1 max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar leads, empresas, tags, telefones..."
          className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted/60 border border-transparent focus:bg-card focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 text-sm transition"
        />
        <kbd className="hidden md:inline-flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground bg-background">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={toggle}
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg hover:bg-accent transition"
          aria-label="Alternar tema"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Notifications bell */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative h-9 w-9 inline-flex items-center justify-center rounded-lg hover:bg-accent transition">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive text-[9px] font-bold text-white ring-2 ring-background flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              {unreadCount === 0 && upcoming.length > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-96 p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-semibold text-sm">Notificações</span>
              {notifications.some((n) => !n.read) && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary hover:underline"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>

            <div className="max-h-105 overflow-y-auto">
              {/* Due now */}
              {dueNow.length > 0 && (
                <>
                  <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-destructive bg-destructive/5">
                    Pendentes agora
                  </p>
                  {dueNow.map((n) => (
                    <div
                      key={n.id}
                      className="group flex items-start gap-3 px-4 py-3 hover:bg-accent/60 transition border-b border-border/50"
                    >
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          markRead(n.id);
                          openLead(n.leadId);
                        }}
                      >
                        <p className="text-sm font-medium leading-snug">{n.message}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Agendado {formatRelativeTime(n.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => snooze(n.id, 24)}
                          className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-accent"
                        >
                          +24h
                        </button>
                        <button
                          onClick={() => dismiss(n.id)}
                          className="text-[10px] text-muted-foreground hover:text-destructive px-1.5 py-0.5 rounded hover:bg-destructive/10"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Upcoming */}
              {upcoming.length > 0 && (
                <>
                  <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
                    Agendados
                  </p>
                  {upcoming.map((n) => (
                    <div
                      key={n.id}
                      className="group flex items-start gap-3 px-4 py-3 hover:bg-accent/60 transition border-b border-border/50"
                    >
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          markRead(n.id);
                          openLead(n.leadId);
                        }}
                      >
                        <p className="text-sm leading-snug text-muted-foreground">{n.message}</p>
                        <p className="text-[11px] text-primary mt-0.5">{formatDueTime(n.dueAt)}</p>
                      </div>
                      <button
                        onClick={() => dismiss(n.id)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 rounded"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </>
              )}

              {dueNow.length === 0 && upcoming.length === 0 && (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Nenhuma notificação pendente
                </div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 ml-1 pl-1 pr-2 py-1 rounded-lg hover:bg-accent transition">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="text-xs font-medium">{displayName ?? "—"}</span>
                <span className="text-[10px] text-muted-foreground">Admin</span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
