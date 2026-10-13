import { useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const sameSegment = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Seleção de vários segmentos: escolhe da lista ou digita um novo e adiciona. Cada segmento
 * vira uma descoberta completa no backend, então há um teto (`max`) para não estourar o orçamento.
 */
export function SegmentPicker({
  value,
  onChange,
  options,
  max,
}: {
  value: string[];
  onChange: (segments: string[]) => void;
  options: string[];
  max: number;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const isSelected = (segment: string) => value.some((item) => sameSegment(item, segment));
  const atLimit = value.length >= max;

  const toggle = (segment: string) => {
    if (isSelected(segment)) {
      onChange(value.filter((item) => !sameSegment(item, segment)));
    } else if (!atLimit) {
      onChange([...value, segment.trim()]);
    }
  };

  const typed = search.trim();
  const canCreate = typed.length > 0 && !options.some((option) => sameSegment(option, typed)) && !isSelected(typed);

  return (
    <div className="space-y-2">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSearch("");
        }}
      >
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
            <span className={value.length === 0 ? "text-muted-foreground" : undefined}>
              {value.length === 0
                ? "Selecione ou digite os segmentos…"
                : `${value.length} segmento${value.length > 1 ? "s" : ""} (máx. ${max})`}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar ou digitar um segmento…" value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>Nenhum segmento na lista.</CommandEmpty>
              <CommandGroup>
                {canCreate && (
                  <CommandItem
                    forceMount
                    value={`__novo__ ${typed}`}
                    disabled={atLimit}
                    onSelect={() => {
                      toggle(typed);
                      setSearch("");
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar “{typed}”
                  </CommandItem>
                )}
                {options.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    disabled={atLimit && !isSelected(option)}
                    onSelect={() => toggle(option)}
                  >
                    <Check className={`mr-2 h-4 w-4 ${isSelected(option) ? "opacity-100" : "opacity-0"}`} />
                    {option}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((segment) => (
            <Badge key={segment} variant="secondary" className="gap-1 pr-1">
              {segment}
              <button
                type="button"
                onClick={() => toggle(segment)}
                aria-label={`Remover ${segment}`}
                className="rounded-sm p-0.5 hover:bg-background/60"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
