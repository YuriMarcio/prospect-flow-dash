import { createFileRoute } from "@tanstack/react-router";
import { AssistenteIAPage } from "@/pages/AssistenteIAPage";

export const Route = createFileRoute("/assistente-ia")({
  head: () => ({ meta: [{ title: "Assistente IA — ProspectAI" }] }),
  component: AssistenteIAPage,
});
