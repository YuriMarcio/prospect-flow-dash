import * as mindMapsRepository from "./mind-maps.repository";
import type { MindMapEdgeInput, MindMapNodeInput } from "./mind-maps.repository";

function validateGraph(nodes: MindMapNodeInput[], edges: MindMapEdgeInput[]) {
  const ids = new Set(nodes.map((n) => n.id));
  if (ids.size !== nodes.length) throw new Error("Existem nós duplicados no mapa.");
  for (const edge of edges) {
    if (!ids.has(edge.source_node_id) || !ids.has(edge.target_node_id)) {
      throw new Error("Uma conexão aponta pra um nó que não existe mais.");
    }
  }
}

export async function listBoardsService() {
  return mindMapsRepository.findAllBoards();
}

export async function createBoardService(name?: string) {
  return mindMapsRepository.createBoard(name?.trim() || "Novo mapa");
}

export async function getBoardGraphService(id: string) {
  const graph = await mindMapsRepository.findGraph(id);
  if (!graph) throw new Error("Mapa mental não encontrado.");
  return graph;
}

export async function renameBoardService(id: string, name: string) {
  if (!name?.trim()) throw new Error("Informe um nome para o mapa.");
  return mindMapsRepository.renameBoard(id, name.trim());
}

export async function deleteBoardService(id: string) {
  return mindMapsRepository.deleteBoard(id);
}

export async function saveGraphService(
  boardId: string,
  input: { nodes: MindMapNodeInput[]; edges: MindMapEdgeInput[]; canvas?: Record<string, unknown> },
) {
  validateGraph(input.nodes, input.edges);
  return mindMapsRepository.replaceGraph(boardId, input);
}
