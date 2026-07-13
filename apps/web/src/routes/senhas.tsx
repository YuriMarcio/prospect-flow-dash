import { createFileRoute } from "@tanstack/react-router";
import { SenhasPage } from "@/pages/SenhasPage";

export const Route = createFileRoute("/senhas")({
  head: () => ({ meta: [{ title: "Cofre de Senhas — ProspectAI" }] }),
  component: SenhasPage,
});
