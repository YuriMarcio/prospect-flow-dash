import { createFileRoute } from "@tanstack/react-router";
import { CapturasPage } from "@/pages/CapturasPage";

export const Route = createFileRoute("/capturas")({
  head: () => ({ meta: [{ title: "Execuções — ProspectAI" }] }),
  component: CapturasPage,
});
