import { createFileRoute } from "@tanstack/react-router";
import { ConfiguracoesPage } from "@/pages/ConfiguracoesPage";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — ProspectAI" }] }),
  component: ConfiguracoesPage,
});
