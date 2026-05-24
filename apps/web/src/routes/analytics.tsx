import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsPage } from "@/pages/AnalyticsPage";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics — ProspectAI" }] }),
  component: AnalyticsPage,
});
