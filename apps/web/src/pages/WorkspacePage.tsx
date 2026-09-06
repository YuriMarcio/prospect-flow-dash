import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Minimize2 } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace";
import { useWorkspaceSync } from "@/hooks/use-workspace-sync";
import { WorkspaceSidebar } from "@/components/workspace/WorkspaceSidebar";
import { DocumentEditor } from "@/components/workspace/DocumentEditor";
import { WorkspaceHome } from "@/components/workspace/WorkspaceHome";
import { CommandPalette } from "@/components/workspace/CommandPalette";

export function WorkspacePage() {
  useWorkspaceSync();
  const pages = useWorkspaceStore((s) => s.pages);
  const createPage = useWorkspaceStore((s) => s.createPage);
  const deletePage = useWorkspaceStore((s) => s.deletePage);
  const touchRecent = useWorkspaceStore((s) => s.touchRecent);

  const navigate = useNavigate();
  const { pageId } = useSearch({ from: "/workspace" });
  const [activeId, setActiveId] = useState<string | null>(pageId ?? null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  // Deep-link vindo de fora (ex: chip "vincular página" no Kanban de objetivos)
  useEffect(() => {
    if (pageId && pageId !== activeId) {
      setActiveId(pageId);
      touchRecent(pageId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a mudanças externas de pageId, não a activeId
  }, [pageId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleSelect(id: string) {
    setActiveId(id || null);
    if (id) touchRecent(id);
    navigate({ to: "/workspace", search: id ? { pageId: id } : {}, replace: true });
  }

  function handleCreate(parentId: string | null = null) {
    const id = createPage(parentId, "");
    handleSelect(id);
  }

  function handleDelete(id: string) {
    deletePage(id);
    handleSelect("");
  }

  function breadcrumbFor(id: string): string[] {
    const crumbs: string[] = [];
    let current = pages[id];
    while (current) {
      crumbs.unshift(current.title || "Sem título");
      current = current.parentId ? pages[current.parentId] : (undefined as never);
    }
    return ["Workspace", ...crumbs];
  }

  const activePage = activeId ? pages[activeId] : undefined;

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {!focusMode && (
        <WorkspaceSidebar activeId={activeId} onSelect={handleSelect} onOpenSearch={() => setSearchOpen(true)} />
      )}

      <div className="flex-1 overflow-y-auto relative animate-fade-in">
        {focusMode && (
          <button
            onClick={() => setFocusMode(false)}
            className="fixed top-4 right-4 z-20 flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors shadow-lg"
          >
            <Minimize2 className="h-3.5 w-3.5" />
            Sair do modo foco
          </button>
        )}

        {activePage ? (
          <DocumentEditor
            page={activePage}
            breadcrumb={breadcrumbFor(activePage.id)}
            onDelete={() => handleDelete(activePage.id)}
            onNavigate={handleSelect}
            focusMode={focusMode}
            onToggleFocus={() => setFocusMode((v) => !v)}
          />
        ) : (
          <WorkspaceHome onOpen={handleSelect} onCreate={() => handleCreate(null)} />
        )}
      </div>

      <CommandPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={(id) => {
          handleSelect(id);
          setSearchOpen(false);
        }}
      />
    </div>
  );
}
