import { createFileRoute } from "@tanstack/react-router";
import { AgendaPage } from "@/pages/AgendaPage";

export const Route = createFileRoute("/agenda")({
  head: () => ({ meta: [{ title: "Agenda — ProspectAI" }] }),
  component: AgendaPage,
});
