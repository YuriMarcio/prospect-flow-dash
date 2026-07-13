import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/pages/WorkspacePage";

export const Route = createFileRoute("/workspace")({
  head: () => ({ meta: [{ title: "Workspace — ProspectAI" }] }),
  component: WorkspacePage,
});
