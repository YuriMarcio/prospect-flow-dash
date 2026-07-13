import { create } from "zustand";
import { persist } from "zustand/middleware";
import { buildSeedPages } from "@/lib/workspaceSeed";
import type { Block, WorkspacePage } from "@/lib/workspaceTypes";

interface WorkspaceState {
  pages: Record<string, WorkspacePage>;
  recentIds: string[];

  createPage: (parentId: string | null, title?: string, icon?: string) => string;
  deletePage: (id: string) => void;
  duplicatePage: (id: string) => string;
  updatePageMeta: (id: string, patch: Partial<Pick<WorkspacePage, "icon" | "title" | "description">>) => void;
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

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      pages: buildSeedPages(),
      recentIds: [],

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
          updatedBy: "yurei",
        };
        set((s) => ({ pages: { ...s.pages, [id]: newPage } }));
        return id;
      },

      deletePage: (id) => {
        set((s) => {
          const toRemove = new Set(collectDescendantIds(s.pages, id));
          const pages = { ...s.pages };
          for (const rid of toRemove) delete pages[rid];
          return { pages, recentIds: s.recentIds.filter((rid) => !toRemove.has(rid)) };
        });
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
        return newId;
      },

      updatePageMeta: (id, patch) => {
        set((s) => {
          const p = s.pages[id];
          if (!p) return s;
          return {
            pages: { ...s.pages, [id]: { ...p, ...patch, updatedAt: new Date().toISOString() } },
          };
        });
      },

      updateBlocks: (id, blocks) => {
        set((s) => {
          const p = s.pages[id];
          if (!p) return s;
          return { pages: { ...s.pages, [id]: { ...p, blocks, updatedAt: new Date().toISOString() } } };
        });
      },

      toggleFavorite: (id) => {
        set((s) => {
          const p = s.pages[id];
          if (!p) return s;
          return { pages: { ...s.pages, [id]: { ...p, favorite: !p.favorite } } };
        });
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
      },

      movePage: (id, newParentId) => {
        set((s) => {
          const page = s.pages[id];
          if (!page || page.parentId === newParentId) return s;
          // Não deixa soltar uma página dentro dela mesma ou de um descendente seu (ciclo).
          if (newParentId && (newParentId === id || collectDescendantIds(s.pages, id).includes(newParentId))) return s;

          const siblingCount = Object.values(s.pages).filter((p) => p.parentId === newParentId && p.id !== id).length;
          return {
            pages: { ...s.pages, [id]: { ...page, parentId: newParentId, order: siblingCount } },
          };
        });
      },
    }),
    { name: "leadflow-workspace" },
  ),
);
