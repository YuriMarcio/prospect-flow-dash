import { FileText, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/store/workspace";
import { useTimeAgo } from "@/lib/workspaceUtils";
import type { WorkspacePage } from "@/lib/workspaceTypes";

const TEMPLATES = ["Documento vazio", "Planejamento de projeto", "Estratégia de prospecção", "Reunião", "Documentação técnica", "Análise de cliente"];

export function WorkspaceHome({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate: () => void }) {
  const pages = useWorkspaceStore((s) => s.pages);
  const recentIds = useWorkspaceStore((s) => s.recentIds);

  const list = Object.values(pages);
  const hasPages = list.length > 0;
  const favorites = list.filter((p) => p.favorite);
  const recents = recentIds.map((id) => pages[id]).filter(Boolean);
  const continueList = [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 2);
  const recentToShow = (recents.length ? recents : list.slice(0, 5)).slice(0, 6);

  if (!hasPages) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-5xl">📚</span>
        <div>
          <h2 className="text-xl font-semibold">Seu Workspace</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Organize estratégias, projetos, documentos e ideias em um único lugar.
          </p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="h-4 w-4" />
          Criar primeira página
        </Button>
        <div className="mt-4">
          <p className="text-xs text-muted-foreground mb-2">Comece com um modelo</p>
          <div className="flex flex-wrap gap-2 justify-center max-w-md">
            {TEMPLATES.map((t) => (
              <button
                key={t}
                onClick={onCreate}
                className="text-xs rounded-full border border-border px-3 py-1.5 hover:bg-accent transition-colors"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-225 px-8 py-10">
      <h1 className="text-3xl font-bold tracking-tight mb-1">Workspace</h1>
      <p className="text-sm text-muted-foreground mb-8">Seu espaço para organizar projetos, estratégias e conhecimento.</p>

      {continueList.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Continuar de onde parou</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {continueList.map((p) => (
              <ContinueCard key={p.id} page={p} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}

      {favorites.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Favoritos</p>
          <div className="space-y-1">
            {favorites.map((p) => (
              <button
                key={p.id}
                onClick={() => onOpen(p.id)}
                className="w-full flex items-center gap-2 text-sm text-left hover:bg-accent/40 rounded-md px-2 py-1.5 transition-colors"
              >
                <Star className="h-3.5 w-3.5 text-warning fill-warning shrink-0" />
                {p.title || "Sem título"}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Recentes</p>
        <div className="space-y-1">
          {recentToShow.map((p) => (
            <button
              key={p.id}
              onClick={() => onOpen(p.id)}
              className="w-full flex items-center gap-2 text-sm text-left hover:bg-accent/40 rounded-md px-2 py-1.5 transition-colors"
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {p.title || "Sem título"}
            </button>
          ))}
        </div>
      </section>

      <Button onClick={onCreate}>
        <Plus className="h-4 w-4" />
        Nova página
      </Button>
    </div>
  );
}

function ContinueCard({ page, onOpen }: { page: WorkspacePage; onOpen: (id: string) => void }) {
  const editedLabel = useTimeAgo(page.updatedAt);
  return (
    <button
      onClick={() => onOpen(page.id)}
      className="rounded-lg border border-border bg-card p-4 text-left hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        <span>{page.icon}</span>
        <span className="font-medium text-sm truncate">{page.title || "Sem título"}</span>
      </div>
      <p className="text-xs text-muted-foreground">Editado {editedLabel}</p>
    </button>
  );
}
