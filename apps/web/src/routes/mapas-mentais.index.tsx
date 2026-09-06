import { createFileRoute } from "@tanstack/react-router";
import { MindMapsPage } from "@/pages/MindMapsPage";

export const Route = createFileRoute("/mapas-mentais/")({
  head: () => ({ meta: [{ title: "Mapas Mentais — ProspectAI" }] }),
  component: MindMapsPage,
});
