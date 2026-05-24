import { useKanbanStore } from "@/store/kanban";
import { useFiltersStore } from "@/store/filters";
import { useLeadModalStore } from "@/store/leadModal";
import { StatusBadge } from "@/components/StatusBadge";
import { Star, Filter } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export function LeadsPage() {
  const leads = useKanbanStore((s) => s.leads);
  const { search, city, category, status, minScore, setFilter, setMinScore, reset } = useFiltersStore();
  const open = useLeadModalStore((s) => s.open);

  const cities = [...new Set(leads.map((l) => l.city))];
  const categories = [...new Set(leads.map((l) => l.category))];

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    if (search && !(l.companyName.toLowerCase().includes(q) || l.phone.includes(q) || l.instagram?.toLowerCase().includes(q) || l.tags.some((t) => t.includes(q)))) return false;
    if (city && l.city !== city) return false;
    if (category && l.category !== category) return false;
    if (status && l.status !== status) return false;
    if (l.score < minScore) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="text-sm text-muted-foreground mt-1">{filtered.length} leads encontrados</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap gap-3 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={city || "all"} onValueChange={(v) => setFilter("city", v === "all" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Cidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as cidades</SelectItem>
            {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={category || "all"} onValueChange={(v) => setFilter("category", v === "all" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status || "all"} onValueChange={(v) => setFilter("status", v === "all" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {["novo", "contato", "qualificado", "negociacao", "ganho", "perdido"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Score ≥</span>
          <input type="number" value={minScore} onChange={(e) => setMinScore(+e.target.value)}
            className="w-16 h-9 rounded-md border border-border bg-background px-2 text-sm" />
        </div>
        <button onClick={reset} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Limpar</button>
      </div>

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
              {filtered.map((l) => (
                <tr key={l.id} onClick={() => open(l.id)}
                  className="border-t border-border hover:bg-accent/40 cursor-pointer transition">
                  <td className="px-4 py-3 font-medium">{l.companyName}<div className="text-xs text-muted-foreground">{l.instagram}</div></td>
                  <td className="px-4 py-3 text-muted-foreground">{l.category}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.city}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1 font-medium"><Star className="h-3 w-3 fill-warning text-warning" />{l.score}</span></td>
                  <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{l.owner}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.lastInteraction}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Nenhum lead encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
