import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getMindMap, saveMindMap, type ApiMindMapEdge, type ApiMindMapNode } from "@/lib/mindMaps";
import { NoteNode, NOTE_COLORS, type NoteCanvasNode, type NoteNodeData } from "./NoteNode";

function toCanvasNodes(apiNodes: ApiMindMapNode[]): NoteCanvasNode[] {
  return apiNodes.map((node) => ({
    id: node.id,
    type: "note",
    position: { x: node.position_x, y: node.position_y },
    data: { label: node.label, color: node.color },
  }));
}

function toCanvasEdges(apiEdges: ApiMindMapEdge[]): Edge[] {
  return apiEdges.map((edge) => ({
    id: edge.id,
    source: edge.source_node_id,
    target: edge.target_node_id,
    label: edge.label ?? undefined,
  }));
}

function defaultFirstNode(): NoteCanvasNode {
  return {
    id: crypto.randomUUID(),
    type: "note",
    position: { x: 80, y: 120 },
    data: { label: "Ideia central", color: NOTE_COLORS[0] },
  };
}

export function MindMapCanvas({ boardId }: { boardId: string }) {
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState<NoteCanvasNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [dirty, setDirty] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const graphQuery = useQuery({
    queryKey: ["mind-map", boardId],
    queryFn: () => getMindMap(boardId),
  });

  useEffect(() => {
    if (!graphQuery.data || loaded) return;
    if (graphQuery.data.nodes.length > 0) {
      setNodes(toCanvasNodes(graphQuery.data.nodes));
      setEdges(toCanvasEdges(graphQuery.data.edges));
    } else {
      setNodes([defaultFirstNode()]);
      setDirty(true);
    }
    setLoaded(true);
  }, [graphQuery.data, loaded, setNodes, setEdges]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveMindMap(boardId, {
        nodes: nodes.map((node) => ({
          id: node.id,
          label: node.data.label,
          color: node.data.color,
          position_x: node.position.x,
          position_y: node.position.y,
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          source_node_id: edge.source,
          target_node_id: edge.target,
          label: typeof edge.label === "string" ? edge.label : null,
        })),
        canvas: {},
      }),
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["mind-map", boardId] });
      queryClient.invalidateQueries({ queryKey: ["mind-maps"] });
      toast.success("Mapa salvo.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) => addEdge({ ...connection, id: crypto.randomUUID() }, current));
      setDirty(true);
    },
    [setEdges],
  );

  function updateNodeData(id: string, patch: Partial<NoteNodeData>) {
    setNodes((current) =>
      current.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...patch } } : node)),
    );
    setDirty(true);
  }

  const nodeTypes = useMemo(
    () => ({
      note: (props: NodeProps<NoteCanvasNode>) => <NoteNode {...props} onChangeData={updateNodeData} />,
    }),
    [],
  );

  function addNote() {
    const id = crypto.randomUUID();
    setNodes((current) => [
      ...current,
      {
        id,
        type: "note",
        position: { x: 120 + current.length * 32, y: 100 + current.length * 24 },
        data: { label: "", color: NOTE_COLORS[0] },
        selected: true,
      },
    ]);
    setDirty(true);
  }

  return (
    <div className="relative h-full min-h-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={(changes) => {
          onNodesChange(changes);
          if (changes.some((c) => c.type === "position" || c.type === "remove")) setDirty(true);
        }}
        onEdgesChange={(changes) => {
          onEdgesChange(changes);
          if (changes.some((c) => c.type === "remove")) setDirty(true);
        }}
        onConnect={onConnect}
        deleteKeyCode={["Backspace", "Delete"]}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="!h-24 !w-36" />
      </ReactFlow>

      <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={addNote}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Nota
        </Button>
      </div>

      <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!dirty || saveMutation.isPending}>
          <Save className="mr-1 h-3.5 w-3.5" />
          {saveMutation.isPending ? "Salvando…" : dirty ? "Salvar mapa" : "Mapa salvo"}
        </Button>
      </div>

      {loaded && nodes.length <= 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 text-center">
          <p className="text-xs text-muted-foreground">
            Clique duas vezes numa nota pra editar o texto. Arraste das bolinhas laterais pra conectar ideias.
          </p>
        </div>
      )}
    </div>
  );
}
