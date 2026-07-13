import { useMemo, useState } from "react";
import { Plus, Search, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VaultEntrySummary } from "@/lib/vaultApi";

type Filter = { type: "all" } | { type: "favorites" } | { type: "category"; value: string } | { type: "tag"; value: string };

export function VaultEntryList({
  entries,
  selectedId,
  onSelect,
  onNewEntry,
}: {
  entries: VaultEntrySummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewEntry: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>({ type: "all" });

  const favorites = useMemo(() => entries.filter((e) => e.favorite), [entries]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) map.set(e.category, (map.get(e.category) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries]);

  const tags = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) for (const t of e.tags) map.set(t, (map.get(t) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const filtered = useMemo(() => {
    let list = entries;
    if (filter.type === "favorites") list = list.filter((e) => e.favorite);
    else if (filter.type === "category") list = list.filter((e) => e.category === filter.value);
    else if (filter.type === "tag") list = list.filter((e) => e.tags.includes(filter.value));

    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter((e) => e.title.toLowerCase().includes(term) || e.username?.toLowerCase().includes(term));
    }
    return [...list].sort((a, b) => a.title.localeCompare(b.title));
  }, [entries, filter, search]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 min-h-0">
      <div className="space-y-4 overflow-y-auto">
        <button
          onClick={() => setFilter({ type: "all" })}
          className={cn(
            "w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
            filter.type === "all" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50",
          )}
        >
          Todas as entradas
          <span>{entries.length}</span>
        </button>

        {favorites.length > 0 && (
          <div>
            <p className="px-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Favoritos · {favorites.length}
            </p>
            <div className="space-y-0.5">
              {favorites.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onSelect(f.id)}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-accent/50 transition-colors text-left"
                >
                  <Star className="h-3.5 w-3.5 text-warning fill-warning shrink-0" />
                  <span className="truncate">{f.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {categories.length > 0 && (
          <div>
            <p className="px-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Categorias</p>
            <div className="space-y-0.5">
              {categories.map(([cat, count]) => (
                <button
                  key={cat}
                  onClick={() => setFilter({ type: "category", value: cat })}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors text-left",
                    filter.type === "category" && filter.value === cat
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50",
                  )}
                >
                  <span className="truncate">{cat}</span>
                  <span className="text-xs">{count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tags.length > 0 && (
          <div>
            <p className="px-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Tags</p>
            <div className="flex flex-wrap gap-1.5 px-3">
              {tags.map(([tag, count]) => (
                <button
                  key={tag}
                  onClick={() => setFilter({ type: "tag", value: tag })}
                  className={cn(
                    "text-[11px] font-medium px-2 py-1 rounded-full border transition-colors",
                    filter.type === "tag" && filter.value === tag
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border text-muted-foreground hover:bg-accent/50",
                  )}
                >
                  {tag} <span className="opacity-60">{count}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden min-h-0">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar entradas…"
              className="pl-8 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={onNewEntry}>
            <Plus className="h-3.5 w-3.5" />
            Nova
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhuma entrada encontrada.</p>
          )}
          {filtered.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onSelect(entry.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                selectedId === entry.id ? "bg-accent" : "hover:bg-accent/40",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{entry.title}</p>
                <p className="text-xs text-muted-foreground truncate">{entry.username ?? "—"}</p>
              </div>
              {entry.favorite && <Star className="h-3.5 w-3.5 text-warning fill-warning shrink-0" />}
              <span className="text-[10px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">
                {entry.category}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
