import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Network, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createMindMap, deleteMindMap, listMindMaps, type MindMapBoardSummary } from "@/lib/mindMaps";

export function MindMapsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<MindMapBoardSummary | null>(null);

  const boardsQuery = useQuery({ queryKey: ["mind-maps"], queryFn: listMindMaps });

  const createMutation = useMutation({
    mutationFn: () => createMindMap(),
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: ["mind-maps"] });
      navigate({ to: "/mapas-mentais/$boardId", params: { boardId: board.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMindMap(id),
    onSuccess: () => {
      toast.success("Mapa excluído.");
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["mind-maps"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const boards = boardsQuery.data ?? [];

  return (
    <div className="mx-auto w-full max-w-225 px-8 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Mapas Mentais</h1>
          <p className="text-sm text-muted-foreground">Desenhe fluxos e ideias livremente, tipo um quadro do Miro.</p>
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          <Plus className="h-4 w-4" />
          Novo mapa
        </Button>
      </div>

      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
          <Network className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-sm">
            Nenhum mapa mental ainda. Crie o primeiro pra começar a organizar suas ideias visualmente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {boards.map((board) => (
            <div
              key={board.id}
              className="group relative rounded-lg border border-border bg-card p-4 text-left hover:border-primary/40 transition-colors"
            >
              <button
                onClick={() => navigate({ to: "/mapas-mentais/$boardId", params: { boardId: board.id } })}
                className="block w-full text-left"
              >
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Network className="h-4.5 w-4.5" />
                </div>
                <p className="font-medium text-sm truncate pr-6">{board.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Atualizado em {new Date(board.updated_at).toLocaleDateString("pt-BR")}
                </p>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity"
                    aria-label={`Opções do mapa ${board.name}`}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setPendingDelete(board)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Todas as notas e conexões desse mapa serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
