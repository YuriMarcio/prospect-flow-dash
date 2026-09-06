import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/pages/WorkspacePage";

interface WorkspaceSearch {
  pageId?: string;
}

export const Route = createFileRoute("/workspace")({
  head: () => ({ meta: [{ title: "Workspace — ProspectAI" }] }),
  validateSearch: (search: Record<string, unknown>): WorkspaceSearch => ({
    pageId: typeof search.pageId === "string" ? search.pageId : undefined,
  }),
  component: WorkspacePage,
});
