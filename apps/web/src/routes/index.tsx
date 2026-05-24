import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/pages/DashboardPage";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — ProspectAI" }] }),
  component: DashboardPage,
});
