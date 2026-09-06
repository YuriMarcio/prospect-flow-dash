import { request } from "@/lib/api";

export interface MindMapBoardSummary {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ApiMindMapNode {
  id: string;
  label: string;
  color: string;
  position_x: number;
  position_y: number;
}

export interface ApiMindMapEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  label?: string | null;
}

export interface MindMapGraph {
  board: MindMapBoardSummary & { canvas: Record<string, unknown> };
  nodes: ApiMindMapNode[];
  edges: ApiMindMapEdge[];
}

export async function listMindMaps(): Promise<MindMapBoardSummary[]> {
  return request("/mind-maps");
}

export async function createMindMap(name?: string): Promise<MindMapBoardSummary> {
  return request("/mind-maps", { method: "POST", body: JSON.stringify({ name }) });
}

export async function getMindMap(id: string): Promise<MindMapGraph> {
  return request(`/mind-maps/${id}`);
}

export async function saveMindMap(
  id: string,
  input: { nodes: ApiMindMapNode[]; edges: ApiMindMapEdge[]; canvas?: Record<string, unknown> },
): Promise<MindMapGraph> {
  return request(`/mind-maps/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export async function renameMindMap(id: string, name: string): Promise<MindMapBoardSummary> {
  return request(`/mind-maps/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
}

export async function deleteMindMap(id: string): Promise<void> {
  await request(`/mind-maps/${id}`, { method: "DELETE" });
}
