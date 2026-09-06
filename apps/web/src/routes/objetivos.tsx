import { createFileRoute } from "@tanstack/react-router";
import { ObjectivesPage } from "@/pages/ObjectivesPage";

export const Route = createFileRoute("/objetivos")({
  head: () => ({ meta: [{ title: "Objetivos — ProspectAI" }] }),
  component: ObjectivesPage,
});
