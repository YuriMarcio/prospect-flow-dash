import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout "vazio" — /mapas-mentais e /mapas-mentais/$boardId são páginas cheias
// e independentes (galeria vs. canvas), não compartilham chrome nenhum. Esse
// arquivo só precisa existir porque mapas-mentais.$boardId.tsx (mesmo prefixo
// no nome do arquivo) faz do TanStack Router tratar "mapas-mentais" como rota
// pai — sem o <Outlet/> aqui, a rota filha nunca chega a ser renderizada.
export const Route = createFileRoute("/mapas-mentais")({
  component: Outlet,
});
