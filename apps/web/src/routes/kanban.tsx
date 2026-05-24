import { createFileRoute } from "@tanstack/react-router";
import { KanbanPage } from "@/pages/KanbanPage";

export const Route = createFileRoute("/kanban")({
  head: () => ({ meta: [{ title: "Kanban — ProspectAI" }] }),
  component: KanbanPage,
});
