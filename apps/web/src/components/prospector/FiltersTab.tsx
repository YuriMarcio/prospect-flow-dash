import { useState } from "react";
import { MapPin, Plus, Wrench, X } from "lucide-react";

const SEGMENT_SUGGESTIONS = ["Hamburgueria", "Pizzaria", "Açaí", "Cafeteria"];

function ChipList({
  icon: Icon,
  values,
  onAdd,
  onRemove,
  placeholder,
}: {
  icon: React.ComponentType<{ className?: string }>;
  values: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  placeholder: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function commit() {
    if (draft.trim()) onAdd(draft.trim());
    setDraft("");
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span
          key={value}
          className="flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs text-primary"
        >
          <Icon className="h-3 w-3" />
          {value}
          <button type="button" onClick={() => onRemove(value)} className="ml-0.5 hover:opacity-70">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          placeholder={placeholder}
          className="rounded-full border border-border bg-card px-2.5 py-1 text-xs outline-none w-32"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Adicionar
        </button>
      )}
    </div>
  );
}

export function FiltersTab({
  filters,
  onChange,
}: {
  filters: { cities: string[]; segments: string[] };
  onChange: (next: { cities: string[]; segments: string[] }) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium">Cidades</p>
        <ChipList
          icon={MapPin}
          values={filters.cities}
          placeholder="Ex: Curitiba"
          onAdd={(value) => onChange({ ...filters, cities: [...filters.cities, value] })}
          onRemove={(value) =>
            onChange({ ...filters, cities: filters.cities.filter((c) => c !== value) })
          }
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Segmentos</p>
        <ChipList
          icon={Wrench}
          values={filters.segments}
          placeholder="Ex: Pizzaria"
          onAdd={(value) => onChange({ ...filters, segments: [...filters.segments, value] })}
          onRemove={(value) =>
            onChange({ ...filters, segments: filters.segments.filter((s) => s !== value) })
          }
        />
        {filters.segments.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            Sugestões: {SEGMENT_SUGGESTIONS.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
