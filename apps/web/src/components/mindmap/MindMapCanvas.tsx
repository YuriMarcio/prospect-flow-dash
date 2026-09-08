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
  type Node,
  type NodeProps,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Circle, Diamond, Frame as FrameIcon, Save, Square, StickyNote, Type } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getMindMap,
  saveMindMap,
  type ApiMindMapEdge,
  type ApiMindMapNode,
  type MindMapNodeType,
  type MindMapShapeKind,
} from "@/lib/mindMaps";
import { NOTE_COLORS } from "./colors";
import { NoteNode, type NoteCanvasNode, type NoteNodeData } from "./NoteNode";
import { ShapeNode, type ShapeCanvasNode, type ShapeKind, type ShapeNodeData } from "./ShapeNode";
import { TextNode, type TextCanvasNode, type TextNodeData } from "./TextNode";
import { FrameNode, type FrameCanvasNode, type FrameNodeData } from "./FrameNode";

type CanvasNode = NoteCanvasNode | ShapeCanvasNode | TextCanvasNode | FrameCanvasNode;
type CanvasNodeData = NoteNodeData | ShapeNodeData | TextNodeData | FrameNodeData;

function toCanvasNodes(apiNodes: ApiMindMapNode[]): CanvasNode[] {
  return apiNodes.map((node): CanvasNode => {
    const shared = {
      id: node.id,
      position: { x: node.position_x, y: node.position_y },
      ...(node.width != null ? { width: node.width } : {}),
      ...(node.height != null ? { height: node.height } : {}),
      ...(node.parent_id ? { parentId: node.parent_id, extent: "parent" as const } : {}),
    };

    if (node.node_type === "shape") {
      return {
        ...shared,
        type: "shape",
        data: { label: node.label, color: node.color, shapeKind: node.shape_kind ?? "rectangle" },
      };
    }
    if (node.node_type === "text") {
      return { ...shared, type: "text", data: { label: node.label, color: node.color } };
    }
    if (node.node_type === "frame") {
      return { ...shared, type: "frame", data: { label: node.label, color: node.color }, zIndex: -1 };
    }
    return { ...shared, type: "note", data: { label: node.label, color: node.color } };
  });
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

function getAbsolutePosition(node: CanvasNode, allNodes: CanvasNode[]): { x: number; y: number } {
  if (!node.parentId) return node.position;
  const parent = allNodes.find((n) => n.id === node.parentId);
  if (!parent) return node.position;
  const parentAbs = getAbsolutePosition(parent, allNodes);
  return { x: parentAbs.x + node.position.x, y: parentAbs.y + node.position.y };
}

const SHAPE_ADD_OPTIONS: Array<{ shapeKind: ShapeKind; label: string; icon: typeof Square }> = [
  { shapeKind: "rectangle", label: "Retângulo", icon: Square },
  { shapeKind: "circle", label: "Círculo", icon: Circle },
  { shapeKind: "diamond", label: "Losango", icon: Diamond },
];

export function MindMapCanvas({ boardId }: { boardId: string }) {
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
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
          node_type: (node.type ?? "note") as MindMapNodeType,
          shape_kind: node.type === "shape" ? (node.data as ShapeNodeData).shapeKind : null,
          width: node.width ?? null,
          height: node.height ?? null,
          parent_id: node.parentId ?? null,
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

  function updateNodeData(id: string, patch: Partial<CanvasNodeData>) {
    setNodes((current) =>
      current.map((node) =>
        node.id === id ? ({ ...node, data: { ...node.data, ...patch } } as CanvasNode) : node,
      ),
    );
    setDirty(true);
  }

  const onNodeDragStop: OnNodeDrag<CanvasNode> = useCallback(
    (_event, draggedNode) => {
      if (draggedNode.type === "frame") return;
      setNodes((current) => {
        const dragged = current.find((n) => n.id === draggedNode.id);
        if (!dragged) return current;

        const draggedAbs = getAbsolutePosition(dragged, current);
        const draggedWidth = dragged.width ?? dragged.measured?.width ?? 160;
        const draggedHeight = dragged.height ?? dragged.measured?.height ?? 60;
        const centerX = draggedAbs.x + draggedWidth / 2;
        const centerY = draggedAbs.y + draggedHeight / 2;

        const targetFrame = current.find((n) => {
          if (n.type !== "frame" || n.id === dragged.id) return false;
          const fw = n.width ?? 200;
          const fh = n.height ?? 140;
          return (
            centerX >= n.position.x &&
            centerX <= n.position.x + fw &&
            centerY >= n.position.y &&
            centerY <= n.position.y + fh
          );
        });

        const currentParentId = dragged.parentId ?? null;
        const targetParentId = targetFrame?.id ?? null;
        if (currentParentId === targetParentId) return current;

        return current.map((n) => {
          if (n.id !== dragged.id) return n;
          if (targetFrame) {
            return {
              ...n,
              parentId: targetFrame.id,
              extent: "parent" as const,
              position: { x: draggedAbs.x - targetFrame.position.x, y: draggedAbs.y - targetFrame.position.y },
            };
          }
          const { parentId: _parentId, extent: _extent, ...rest } = n;
          return { ...rest, position: draggedAbs } as CanvasNode;
        });
      });
      setDirty(true);
    },
    [setNodes],
  );

  const nodeTypes = useMemo(
    () => ({
      note: (props: NodeProps<NoteCanvasNode>) => <NoteNode {...props} onChangeData={updateNodeData} />,
      shape: (props: NodeProps<ShapeCanvasNode>) => <ShapeNode {...props} onChangeData={updateNodeData} />,
      text: (props: NodeProps<TextCanvasNode>) => <TextNode {...props} onChangeData={updateNodeData} />,
      frame: (props: NodeProps<FrameCanvasNode>) => <FrameNode {...props} onChangeData={updateNodeData} />,
    }),
    [],
  );

  function nextOffset() {
    const index = nodes.length;
    return { x: 120 + index * 32, y: 100 + index * 24 };
  }

  function addNote() {
    const id = crypto.randomUUID();
    setNodes((current) => [
      ...current,
      { id, type: "note", position: nextOffset(), data: { label: "", color: NOTE_COLORS[0] }, selected: true },
    ]);
    setDirty(true);
  }

  function addShape(shapeKind: ShapeKind) {
    const id = crypto.randomUUID();
    setNodes((current) => [
      ...current,
      {
        id,
        type: "shape",
        position: nextOffset(),
        width: shapeKind === "rectangle" ? 140 : 120,
        height: shapeKind === "rectangle" ? 90 : 120,
        data: { label: "", color: NOTE_COLORS[0], shapeKind },
        selected: true,
      },
    ]);
    setDirty(true);
  }

  function addText() {
    const id = crypto.randomUUID();
    setNodes((current) => [
      ...current,
      {
        id,
        type: "text",
        position: nextOffset(),
        width: 160,
        height: 40,
        data: { label: "", color: "#0f172a" },
        selected: true,
      },
    ]);
    setDirty(true);
  }

  function addFrame() {
    const id = crypto.randomUUID();
    setNodes((current) => [
      ...current,
      {
        id,
        type: "frame",
        position: nextOffset(),
        width: 360,
        height: 260,
        zIndex: -1,
        data: { label: "Frame", color: NOTE_COLORS[0] },
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
          if (changes.some((c) => c.type === "position" || c.type === "remove" || c.type === "dimensions"))
            setDirty(true);
        }}
        onEdgesChange={(changes) => {
          onEdgesChange(changes);
          if (changes.some((c) => c.type === "remove")) setDirty(true);
        }}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        deleteKeyCode={["Backspace", "Delete"]}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="!h-24 !w-36" />
      </ReactFlow>

      <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-md border border-border bg-background/95 p-1 shadow-sm backdrop-blur">
        <Button variant="ghost" size="sm" onClick={addNote} title="Nota">
          <StickyNote className="h-3.5 w-3.5" />
        </Button>
        {SHAPE_ADD_OPTIONS.map(({ shapeKind, label, icon: Icon }) => (
          <Button key={shapeKind} variant="ghost" size="sm" onClick={() => addShape(shapeKind)} title={label}>
            <Icon className="h-3.5 w-3.5" />
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={addText} title="Texto">
          <Type className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={addFrame} title="Frame">
          <FrameIcon className="h-3.5 w-3.5" />
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
