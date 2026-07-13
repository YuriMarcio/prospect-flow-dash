import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { filterSlashCommands, type SlashCommandDef } from "./blockCommands";
import type { BlockType } from "@/lib/workspaceTypes";

const GROUPS = ["Básico", "Mídia", "Avançado"] as const;

export function SlashMenu({
  query,
  activeIndex,
  onHoverIndex,
  onSelect,
}: {
  query: string;
  activeIndex: number;
  onHoverIndex: (i: number) => void;
  onSelect: (type: BlockType) => void;
}) {
  const filtered = filterSlashCommands(query);

  return (
    <div className="absolute z-30 top-full left-0 mt-1 w-64 rounded-lg border border-border bg-popover shadow-2xl overflow-hidden animate-fade-in">
      <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border flex items-center gap-2">
        <Search className="h-3.5 w-3.5" />
        Buscar um bloco…
      </div>
      <div className="max-h-72 overflow-y-auto p-1">
        {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum resultado.</p>}
        {GROUPS.map((group) => {
          const items = filtered.filter((c) => c.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-1 last:mb-0">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </p>
              {items.map((c: SlashCommandDef) => {
                const globalIndex = filtered.indexOf(c);
                return (
                  <button
                    key={c.type}
                    type="button"
                    onMouseEnter={() => onHoverIndex(globalIndex)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(c.type);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors",
                      globalIndex === activeIndex ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60",
                    )}
                  >
                    <c.icon className="h-4 w-4 shrink-0" />
                    {c.label}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
