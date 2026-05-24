import { createFileRoute } from "@tanstack/react-router";
import { LeadsPage } from "@/pages/LeadsPage";

export const Route = createFileRoute("/leads")({
  head: () => ({ meta: [{ title: "Leads — ProspectAI" }] }),
  component: LeadsPage,
});
