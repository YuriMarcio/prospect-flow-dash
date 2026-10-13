import { useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useKanbanStore } from "@/store/kanban";
import { useFiltersStore } from "@/store/filters";
import { useLeadModalStore } from "@/store/leadModal";
import { StatusBadge } from "@/components/StatusBadge";
import { ChevronDown, Filter, MapPin, Star } from "lucide-react";
import { useLeadsSync } from "@/hooks/use-leads-sync";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { Lead } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LeadsPage() {
  const leads = useKanbanStore((s) => s.leads);
  const leadsQuery = useLeadsSync();
  const { search, city, category, status, minScore, setFilter, setMinScore, reset } =
    useFiltersStore();
  const open = useLeadModalStore((s) => s.open);
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const cities = [...new Set(leads.map((l) => l.city))];
  const categories = [...new Set(leads.map((l) => l.category))];

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    if (
      search &&
      !(
        l.companyName.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        l.instagram?.toLowerCase().includes(q) ||
        l.tags.some((t) => t.includes(q))
      )
    )
      return false;
    if (city && l.city !== city) return false;
    if (category && l.category !== category) return false;
    if (status && l.status !== status) return false;
    if (l.score < minScore) return false;
    return true;
  });

  // Quantos filtros do painel estão ligados (a busca do topo não conta: ela tem o próprio campo)
  const activeFilters = [city, category, status].filter(Boolean).length + (minScore > 0 ? 1 : 0);

  return (
    <div className="space-y-3 p-4 animate-fade-in md:space-y-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {leadsQuery.isLoading ? "Carregando leads..." : `${filtered.length} leads encontrados`}
        </p>
        {leadsQuery.isError && (
          <p className="text-sm text-destructive mt-1">
            Não foi possível carregar os leads da API.
          </p>
        )}
      </div>

      {/* Celular: os filtros ficam recolhidos atrás de um botão pra lista aparecer logo */}
      <button
        type="button"
        onClick={() => setFiltersOpen((v) => !v)}
        aria-expanded={filtersOpen}
        className="flex h-11 w-full items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium md:hidden"
      >
        <Filter className="h-4 w-4 text-muted-foreground" />
        Filtros
        {activeFilters > 0 && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
            {activeFilters}
          </span>
        )}
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 text-muted-foreground transition-transform",
            filtersOpen && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "rounded-xl border border-border bg-card p-4",
          filtersOpen ? "grid grid-cols-2 gap-3" : "hidden",
          "md:flex md:flex-wrap md:items-center md:gap-3",
        )}
      >
        <Filter className="hidden h-4 w-4 text-muted-foreground md:block" />
        <Select
          value={city || "all"}
          onValueChange={(v) => setFilter("city", v === "all" ? "" : v)}
        >
          <SelectTrigger className="col-span-2 h-10 w-full md:col-auto md:h-9 md:w-40">
            <SelectValue placeholder="Cidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as cidades</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={category || "all"}
          onValueChange={(v) => setFilter("category", v === "all" ? "" : v)}
        >
          <SelectTrigger className="col-span-2 h-10 w-full md:col-auto md:h-9 md:w-48">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status || "all"}
          onValueChange={(v) => setFilter("status", v === "all" ? "" : v)}
        >
          <SelectTrigger className="col-span-2 h-10 w-full md:col-auto md:h-9 md:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {["novo", "contato", "qualificado", "negociacao", "ganho", "perdido"].map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <span className="whitespace-nowrap text-muted-foreground">Score ≥</span>
          <input
            type="number"
            inputMode="numeric"
            value={minScore}
            onChange={(e) => setMinScore(+e.target.value)}
            // 16px no celular: abaixo disso o iOS dá zoom na tela ao focar o campo
            className="h-10 w-full min-w-0 rounded-md border border-border bg-background px-2 text-base md:h-9 md:w-16 md:text-sm"
          />
        </label>
        <button
          onClick={reset}
          className="col-span-2 h-10 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground md:ml-auto md:h-auto md:border-0 md:text-xs"
        >
          Limpar
        </button>
      </div>

      {/* Só no cliente: o servidor não sabe se a tela é de celular e mandaria a tabela de desktop por um instante */}
      <ClientOnly fallback={<div className="h-64 animate-pulse rounded-xl bg-muted/40" />}>
        {isMobile ? (
          <LeadCardList leads={filtered} onOpen={open} />
        ) : (
          <LeadTable leads={filtered} onOpen={open} />
        )}
      </ClientOnly>
    </div>
  );
}

/** Celular: um card por lead, em vez da tabela de 7 colunas que só cabia rolando pro lado. */
function LeadCardList({ leads, onOpen }: { leads: Lead[]; onOpen: (id: string) => void }) {
  if (leads.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        Nenhum lead encontrado
      </p>
    );
  }

  return (
    <ul className="space-y-2.5 pb-4">
      {leads.map((l) => (
        <li key={l.id}>
          <button
            type="button"
            onClick={() => onOpen(l.id)}
            className="block w-full space-y-1.5 rounded-xl border border-border bg-card px-3.5 py-3 text-left shadow-sm transition-colors active:bg-accent/40"
          >
            <div className="flex items-start gap-2">
              <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">
                {l.companyName}
              </span>
              <StatusBadge status={l.status} className="shrink-0" />
            </div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="truncate">{l.category}</span>
              <span className="opacity-40">•</span>
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{l.city}</span>
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex shrink-0 items-center gap-1 font-semibold tabular-nums text-foreground">
                <Star className="h-3 w-3 fill-warning text-warning" />
                {l.score}
              </span>
              {l.instagram && <span className="min-w-0 truncate">{l.instagram}</span>}
              <span className="ml-auto shrink-0">
                {l.owner.split(" ")[0]} · {l.lastInteraction}
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function LeadTable({ leads, onOpen }: { leads: Lead[]; onOpen: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Empresa</th>
              <th className="text-left px-4 py-3">Categoria</th>
              <th className="text-left px-4 py-3">Cidade</th>
              <th className="text-left px-4 py-3">Score</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Responsável</th>
              <th className="text-left px-4 py-3">Última int.</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr
                key={l.id}
                onClick={() => onOpen(l.id)}
                className="border-t border-border hover:bg-accent/40 cursor-pointer transition"
              >
                <td className="px-4 py-3 font-medium">
                  {l.companyName}
                  <div className="text-xs text-muted-foreground">{l.instagram}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{l.category}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.city}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Star className="h-3 w-3 fill-warning text-warning" />
                    {l.score}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={l.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{l.owner}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.lastInteraction}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  Nenhum lead encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
