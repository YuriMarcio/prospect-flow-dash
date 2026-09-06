import { Network } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { listMindMaps } from "@/lib/mindMaps";

export function MindMapPicker({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (boardId: string, boardName: string) => void;
}) {
  const boardsQuery = useQuery({ queryKey: ["mind-maps"], queryFn: listMindMaps, enabled: open });
  const boards = boardsQuery.data ?? [];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar mapa mental…" />
      <CommandList>
        <CommandEmpty>Nenhum mapa encontrado.</CommandEmpty>
        <CommandGroup heading="Mapas mentais">
          {boards.map((board) => (
            <CommandItem
              key={board.id}
              value={board.name}
              onSelect={() => onSelect(board.id, board.name)}
              className="flex items-center gap-2"
            >
              <Network className="h-4 w-4 shrink-0" />
              <span className="truncate">{board.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
