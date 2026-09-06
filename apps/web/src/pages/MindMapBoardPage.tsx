import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { MindMapCanvas } from "@/components/mindmap/MindMapCanvas";
import { getMindMap, renameMindMap } from "@/lib/mindMaps";

export function MindMapBoardPage({ boardId }: { boardId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const boardQuery = useQuery({
    queryKey: ["mind-map", boardId],
    queryFn: () => getMindMap(boardId),
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) => renameMindMap(boardId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mind-map", boardId] });
      queryClient.invalidateQueries({ queryKey: ["mind-maps"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function handleRename() {
    const current = boardQuery.data?.board.name ?? "";
    const next = window.prompt("Nome do mapa", current);
    if (next && next.trim() && next.trim() !== current) {
      renameMutation.mutate(next.trim());
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <button
          onClick={() => navigate({ to: "/mapas-mentais" })}
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent"
          aria-label="Voltar pros mapas"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium truncate">{boardQuery.data?.board.name ?? "Carregando…"}</span>
        <button
          onClick={handleRename}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
          aria-label="Renomear mapa"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {boardQuery.data && <MindMapCanvas boardId={boardId} />}
      </div>
    </div>
  );
}
