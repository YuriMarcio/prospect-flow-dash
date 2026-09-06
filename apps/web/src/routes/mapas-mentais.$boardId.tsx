import { createFileRoute } from "@tanstack/react-router";
import { MindMapBoardPage } from "@/pages/MindMapBoardPage";

export const Route = createFileRoute("/mapas-mentais/$boardId")({
  head: () => ({ meta: [{ title: "Mapa Mental — ProspectAI" }] }),
  component: RouteComponent,
});

function RouteComponent() {
  const { boardId } = Route.useParams();
  return <MindMapBoardPage boardId={boardId} />;
}
