import { create } from "zustand";
import { toast } from "sonner";
import type { Block, WorkspacePage } from "@/lib/workspaceTypes";
import { debounce } from "@/lib/debounce";
import { useAuthStore } from "@/store/auth";
import {
  createWorkspacePage,
  deleteWorkspacePage,
  duplicateWorkspacePage,
  moveWorkspacePage,
  reorderWorkspaceSiblings,
  setWorkspacePageFavorite,
  updateWorkspacePageBlocks,
  updateWorkspacePageMeta,
} from "@/lib/workspaceApi";

interface WorkspaceState {
  pages: Record<string, WorkspacePage>;
  recentIds: string[];

  setPages: (pages: WorkspacePage[]) => void;
  createPage: (parentId: string | null, title?: string, icon?: string) => string;
  deletePage: (id: string) => void;
  duplicatePage: (id: string) => string;
  updatePageMeta: (
    id: string,
    patch: Partial<Pick<WorkspacePage, "icon" | "title" | "description" | "linkedBoardId">>,
  ) => void;
  updateBlocks: (id: string, blocks: Block[]) => void;
  toggleFavorite: (id: string) => void;
  touchRecent: (id: string) => void;
  reorderSiblings: (parentId: string | null, orderedIds: string[]) => void;
  movePage: (id: string, newParentId: string | null) => void;
}

function collectDescendantIds(pages: Record<string, WorkspacePage>, rootId: string): string[] {
  const ids: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const current = stack.pop()!;
    ids.push(current);
    for (const p of Object.values(pages)) {
      if (p.parentId === current) stack.push(p.id);
    }
  }
  return ids;
}

function currentUserName(): string {
  return useAuthStore.getState().displayName ?? "";
}

function reportError(action: string) {
  return (err: unknown) => {
    console.error(`[workspace] falha ao ${action}`, err);
    toast.error(`Não foi possível salvar (${action}). Tente novamente.`);
  };
}

// A cada tecla digitada BlockList.tsx chama updateBlocks — debounça só a
// chamada de rede, o estado local (setBlocks) continua instantâneo.
const debouncedSaveBlocks = debounce((id: string, blocks: Block[]) => {
  runAfterCreate(id, () => updateWorkspacePageBlocks(id, blocks)).catch(reportError("salvar texto"));
}, 600);

// createPage devolve o id na hora (otimista) e o usuário pode editar título/
// texto imediatamente em seguida — sem isso, o POST de criação e o PATCH da
// primeira edição corririam em paralelo sem ordem garantida, e se o PATCH
// chegasse primeiro no servidor a linha ainda não existiria (edição perdida
// silenciosamente). Toda mutação sobre um id recém-criado espera essa
// promise antes de disparar sua própria chamada de rede.
const pendingCreates = new Map<string, Promise<unknown>>();

function trackCreate(id: string, promise: Promise<unknown>) {
  const settled = promise.catch(() => {});
  pendingCreates.set(id, settled);
  settled.finally(() => {
    if (pendingCreates.get(id) === settled) pendingCreates.delete(id);
  });
}

async function runAfterCreate<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const pending = pendingCreates.get(id);
  if (pending) await pending;
  return fn();
}

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  pages: {},
  recentIds: [],

  setPages: (pages) => {
    set({ pages: Object.fromEntries(pages.map((p) => [p.id, p])) });
  },

  createPage: (parentId, title = "", icon = "📄") => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const siblingCount = Object.values(get().pages).filter((p) => p.parentId === parentId).length;
    const newPage: WorkspacePage = {
      id,
      icon,
      title,
      description: "",
      parentId,
      favorite: false,
      order: siblingCount,
      blocks: [{ id: crypto.randomUUID(), type: "paragraph", content: "" }],
      createdAt: now,
      updatedAt: now,
      updatedBy: currentUserName(),
    };
    set((s) => ({ pages: { ...s.pages, [id]: newPage } }));
    trackCreate(id, createWorkspacePage({ id, parentId, title, icon }).catch(reportError("criar página")));
    return id;
  },

  deletePage: (id) => {
    set((s) => {
      const toRemove = new Set(collectDescendantIds(s.pages, id));
      const pages = { ...s.pages };
      for (const rid of toRemove) delete pages[rid];
      return { pages, recentIds: s.recentIds.filter((rid) => !toRemove.has(rid)) };
    });
    runAfterCreate(id, () => deleteWorkspacePage(id)).catch(reportError("excluir página"));
  },

  duplicatePage: (id) => {
    const source = get().pages[id];
    if (!source) return id;
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    const siblingCount = Object.values(get().pages).filter((p) => p.parentId === source.parentId).length;
    const copy: WorkspacePage = {
      ...source,
      id: newId,
      title: `${source.title} (cópia)`,
      favorite: false,
      order: siblingCount,
      blocks: source.blocks.map((b) => ({ ...b, id: crypto.randomUUID() })),
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ pages: { ...s.pages, [newId]: copy } }));
    trackCreate(newId, runAfterCreate(id, () => duplicateWorkspacePage(id, newId)).catch(reportError("duplicar página")));
    return newId;
  },

  updatePageMeta: (id, patch) => {
    set((s) => {
      const p = s.pages[id];
      if (!p) return s;
      return {
        pages: {
          ...s.pages,
          [id]: { ...p, ...patch, updatedAt: new Date().toISOString(), updatedBy: currentUserName() },
        },
      };
    });
    runAfterCreate(id, () => updateWorkspacePageMeta(id, patch)).catch(reportError("salvar página"));
  },

  updateBlocks: (id, blocks) => {
    set((s) => {
      const p = s.pages[id];
      if (!p) return s;
      return {
        pages: {
          ...s.pages,
          [id]: { ...p, blocks, updatedAt: new Date().toISOString(), updatedBy: currentUserName() },
        },
      };
    });
    debouncedSaveBlocks(id, blocks);
  },

  toggleFavorite: (id) => {
    const next = !get().pages[id]?.favorite;
    set((s) => {
      const p = s.pages[id];
      if (!p) return s;
      return { pages: { ...s.pages, [id]: { ...p, favorite: !p.favorite } } };
    });
    runAfterCreate(id, () => setWorkspacePageFavorite(id, next)).catch(reportError("favoritar página"));
  },

  touchRecent: (id) => {
    set((s) => ({ recentIds: [id, ...s.recentIds.filter((rid) => rid !== id)].slice(0, 10) }));
  },

  reorderSiblings: (parentId, orderedIds) => {
    set((s) => {
      const pages = { ...s.pages };
      orderedIds.forEach((id, index) => {
        if (pages[id]) pages[id] = { ...pages[id], order: index };
      });
      return { pages };
    });
    reorderWorkspaceSiblings(orderedIds).catch(reportError("reordenar páginas"));
  },

  movePage: (id, newParentId) => {
    let moved = false;
    set((s) => {
      const page = s.pages[id];
      if (!page || page.parentId === newParentId) return s;
      if (newParentId && (newParentId === id || collectDescendantIds(s.pages, id).includes(newParentId))) return s;

      const siblingCount = Object.values(s.pages).filter((p) => p.parentId === newParentId && p.id !== id).length;
      moved = true;
      return {
        pages: { ...s.pages, [id]: { ...page, parentId: newParentId, order: siblingCount } },
      };
    });
    if (moved) runAfterCreate(id, () => moveWorkspacePage(id, newParentId)).catch(reportError("mover página"));
  },
}));
