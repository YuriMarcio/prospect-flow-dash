import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { listLeadCities } from "@/lib/prospector";

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/**
 * Seletor de cidades do filtro da campanha: busca com sugestões vindas dos
 * leads existentes (com contagem), e permite texto livre para cidades que
 * ainda não têm leads. Selecionadas viram chips removíveis.
 */
export function CityCombobox({
  values,
  onChange,
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const citiesQuery = useQuery({
    queryKey: ["lead-cities"],
    queryFn: listLeadCities,
    staleTime: 5 * 60_000,
  });
  const cities = citiesQuery.data ?? [];

  const selectedKeys = useMemo(() => new Set(values.map(normalize)), [values]);

  const suggestions = useMemo(() => {
    const q = normalize(query);
    return cities
      .filter((c) => !selectedKeys.has(normalize(c.city)))
      .filter((c) => !q || normalize(c.city).includes(q))
      .slice(0, 12);
  }, [cities, query, selectedKeys]);

  const exactMatch = suggestions.some((c) => normalize(c.city) === normalize(query));
  const canAddFreeText =
    query.trim().length > 0 && !exactMatch && !selectedKeys.has(normalize(query));

  function add(city: string) {
    onChange([...values, city.trim()]);
    setQuery("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {values.map((city) => (
        <span
          key={city}
          className="flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs text-primary"
        >
          <MapPin className="h-3 w-3" />
          {city}
          <button
            type="button"
            onClick={() => onChange(values.filter((c) => c !== city))}
            className="ml-0.5 hover:opacity-70"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            Adicionar cidade
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Buscar cidade…" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>
                {citiesQuery.isLoading ? "Carregando…" : "Nenhuma cidade encontrada nos leads."}
              </CommandEmpty>
              <CommandGroup heading="Cidades dos seus leads">
                {suggestions.map((c) => (
                  <CommandItem key={c.city} value={c.city} onSelect={() => add(c.city)}>
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1">{c.city}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {c.count} lead{c.count === 1 ? "" : "s"}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {canAddFreeText && (
                <CommandGroup heading="Outra cidade">
                  <CommandItem value={`__free__${query}`} onSelect={() => add(query)}>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    Usar "{query.trim()}" (ainda sem leads)
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
