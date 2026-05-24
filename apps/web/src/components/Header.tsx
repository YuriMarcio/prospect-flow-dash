import { Search, Bell, Moon, Sun, Menu } from "lucide-react";
import { useThemeStore } from "@/store/theme";
import { useFiltersStore } from "@/store/filters";
import { useMobileSidebarStore } from "@/store/mobileSidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { theme, toggle } = useThemeStore();
  const { search, setSearch } = useFiltersStore();
  const { toggle: toggleMobileSidebar } = useMobileSidebarStore();

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative h-9 w-9 inline-flex items-center justify-center rounded-lg hover:bg-accent transition">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notificações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {["Novo lead capturado: Burger House", "Captura iFood concluída", "Lead Sakura Sushi movido para Negociação"].map((n) => (
              <DropdownMenuItem key={n} className="flex flex-col items-start gap-0.5 py-2.5">
                <span className="text-sm">{n}</span>
                <span className="text-xs text-muted-foreground">há poucos minutos</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 ml-1 pl-1 pr-2 py-1 rounded-lg hover:bg-accent transition">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">AS</AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="text-xs font-medium">Ana Silva</span>
                <span className="text-[10px] text-muted-foreground">Admin</span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Perfil</DropdownMenuItem>
            <DropdownMenuItem>Equipe <Badge variant="secondary" className="ml-auto">4</Badge></DropdownMenuItem>
            <DropdownMenuItem>Faturamento</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Sair</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
