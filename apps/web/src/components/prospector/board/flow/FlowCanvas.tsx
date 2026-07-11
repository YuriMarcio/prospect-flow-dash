import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type OnBeforeDelete,
  type OnSelectionChangeFunc,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  BookmarkPlus,
  Clock,
  Flag,
  FolderOpen,
  GitBranch,
  MessageSquare,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { listBotMessages } from "@/lib/prospector";
import {
  getFlow,
  saveFlow,
  listFlowTemplates,
  createFlowTemplate,
  applyFlowTemplate,
  deleteFlowTemplate,
  type ApiFlowEdge,
  type ApiFlowNode,
  type FlowNodeConfig,
  type FlowNodeType,
  type FlowTemplate,
} from "@/lib/flows";
import { MessagesContext, edgeLabelForHandle, nodeTypes, type CanvasNode } from "./nodes";
import { NodeEditorPanel } from "./NodeEditorPanel";

function toCanvasNodes(apiNodes: ApiFlowNode[]): CanvasNode[] {
  return apiNodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: { x: node.position_x, y: node.position_y },
    data: { config: node.config ?? {}, messageId: node.message_id ?? null },
  }));
}

function toCanvasEdges(apiEdges: ApiFlowEdge[]): Edge[] {
  return apiEdges.map((edge) => ({
    id: edge.id,
    source: edge.source_node_id,
    target: edge.target_node_id,
    sourceHandle: edge.source_handle,
    label: edgeLabelForHandle(edge.source_handle),
  }));
}

function defaultStartNode(): CanvasNode {
  return {
    id: crypto.randomUUID(),
    type: "start",
    position: { x: 40, y: 160 },
    data: { config: {}, messageId: null },
  };
}

const ADD_NODE_OPTIONS: Array<{
  type: FlowNodeType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  config: FlowNodeConfig;
}> = [
  { type: "message", label: "Mensagem", icon: MessageSquare, config: {} },
  { type: "wait", label: "Espera / follow-up", icon: Clock, config: { hours: 48 } },
  { type: "intent_router", label: "Classificar (IA)", icon: GitBranch, config: {} },
  { type: "action", label: "Ação", icon: Flag, config: { kind: "end" } },
];

export function FlowCanvas({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [dirty, setDirty] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);
  const [pendingApply, setPendingApply] = useState<FlowTemplate | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FlowTemplate | null>(null);

  const flowQuery = useQuery({
    queryKey: ["flow", campaignId],
    queryFn: () => getFlow(campaignId),
  });

  const messagesQuery = useQuery({
    queryKey: ["bot-messages", campaignId],
    queryFn: () => listBotMessages(campaignId),
  });
  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);
  const messagesById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  // Carrega o grafo do servidor uma vez (sem sobrescrever edições em andamento)
  useEffect(() => {
    if (!flowQuery.data || loaded) return;
    if (flowQuery.data.nodes.length > 0) {
      setNodes(toCanvasNodes(flowQuery.data.nodes));
      setEdges(toCanvasEdges(flowQuery.data.edges));
    } else {
      setNodes([defaultStartNode()]);
      setDirty(true);
    }
    setLoaded(true);
  }, [flowQuery.data, loaded, setNodes, setEdges]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveFlow(campaignId, {
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.type as FlowNodeType,
          message_id: node.data.messageId,
          config: node.data.config,
          position_x: node.position.x,
          position_y: node.position.y,
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          source_node_id: edge.source,
          target_node_id: edge.target,
          source_handle: edge.sourceHandle ?? "next",
        })),
        canvas: {},
      }),
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["flow", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-status", campaignId] });
      toast.success("Fluxo salvo.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const templatesQuery = useQuery({
    queryKey: ["flow-templates"],
    queryFn: listFlowTemplates,
    enabled: applyTemplateOpen,
  });

  const createTemplateMutation = useMutation({
    mutationFn: () =>
      createFlowTemplate({
        campaignId,
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Modelo salvo.");
      setSaveTemplateOpen(false);
      setTemplateName("");
      setTemplateDescription("");
      queryClient.invalidateQueries({ queryKey: ["flow-templates"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const applyTemplateMutation = useMutation({
    mutationFn: (templateId: string) => applyFlowTemplate(campaignId, templateId),
    onSuccess: (result) => {
      // Aplica o grafo retornado direto no canvas — evita depender do refetch
      // assíncrono de ["flow", campaignId] (que chegaria tarde demais e/ou
      // fora de ordem em relação a este setLoaded).
      setNodes(toCanvasNodes(result.nodes));
      setEdges(toCanvasEdges(result.edges));
      setSelectedId(null);
      setDirty(false);
      toast.success("Modelo aplicado.");
      setPendingApply(null);
      setApplyTemplateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["flow", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["bot-messages", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-status", campaignId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => deleteFlowTemplate(id),
    onSuccess: () => {
      toast.success("Modelo excluído.");
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["flow-templates"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) => {
        // Uma conexão por porta de saída — a nova substitui a anterior
        const handle = connection.sourceHandle ?? "next";
        const filtered = current.filter(
          (edge) =>
            !(edge.source === connection.source && (edge.sourceHandle ?? "next") === handle),
        );
        return addEdge(
          {
            ...connection,
            id: crypto.randomUUID(),
            label: edgeLabelForHandle(connection.sourceHandle),
          },
          filtered,
        );
      });
      setDirty(true);
    },
    [setEdges],
  );

  const onBeforeDelete: OnBeforeDelete<CanvasNode, Edge> = useCallback(
    async ({ nodes: nodesToDelete, edges: edgesToDelete }) => {
      const withoutStart = nodesToDelete.filter((node) => node.type !== "start");
      if (withoutStart.length === 0 && edgesToDelete.length === 0) return false;
      return { nodes: withoutStart, edges: edgesToDelete };
    },
    [],
  );

  const onSelectionChange: OnSelectionChangeFunc<CanvasNode, Edge> = useCallback(
    ({ nodes: selected }) => {
      setSelectedId(selected[0]?.id ?? null);
    },
    [],
  );

  function addNode(option: (typeof ADD_NODE_OPTIONS)[number]) {
    const id = crypto.randomUUID();
    setNodes((current) => [
      ...current,
      {
        id,
        type: option.type,
        position: { x: 120 + current.length * 48, y: 80 + current.length * 32 },
        data: { config: { ...option.config }, messageId: null },
        selected: true,
      } as CanvasNode,
    ]);
    setSelectedId(id);
    setDirty(true);
  }

  function updateNodeData(
    id: string,
    patch: { config?: FlowNodeConfig; messageId?: string | null },
  ) {
    setNodes((current) =>
      current.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                config: patch.config ?? node.data.config,
                messageId: patch.messageId !== undefined ? patch.messageId : node.data.messageId,
              },
            }
          : node,
      ),
    );
    setDirty(true);
  }

  function deleteNode(id: string) {
    setNodes((current) => current.filter((node) => node.id !== id));
    setEdges((current) => current.filter((edge) => edge.source !== id && edge.target !== id));
    setSelectedId(null);
    setDirty(true);
  }

  const selectedNode = selectedId ? (nodes.find((node) => node.id === selectedId) ?? null) : null;

  return (
    <MessagesContext.Provider value={messagesById}>
      <div className="flex h-full min-h-0">
        <div className="relative flex-1 min-w-0">
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
            onBeforeDelete={onBeforeDelete}
            onSelectionChange={onSelectionChange}
            defaultEdgeOptions={{
              type: "smoothstep",
              markerEnd: { type: MarkerType.ArrowClosed },
            }}
            deleteKeyCode={["Backspace", "Delete"]}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!h-24 !w-36" />
          </ReactFlow>

          {/* Toolbar de nós + salvar */}
          <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-lg border border-border bg-card/95 p-1.5 shadow-sm backdrop-blur">
            {ADD_NODE_OPTIONS.map((option) => (
              <button
                key={option.type}
                type="button"
                onClick={() => addNode(option)}
                className="flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <option.icon className="h-3 w-3" /> {option.label}
              </button>
            ))}
          </div>

          <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setApplyTemplateOpen(true)}>
              <FolderOpen className="mr-1 h-3.5 w-3.5" />
              Aplicar modelo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSaveTemplateOpen(true)}
              disabled={nodes.length === 0 || dirty}
              title={dirty ? "Salve o fluxo antes de virar modelo" : undefined}
            >
              <BookmarkPlus className="mr-1 h-3.5 w-3.5" />
              Salvar como modelo
            </Button>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!dirty || saveMutation.isPending}
            >
              <Save className="mr-1 h-3.5 w-3.5" />
              {saveMutation.isPending ? "Salvando…" : dirty ? "Salvar fluxo" : "Fluxo salvo"}
            </Button>
          </div>

          {loaded && nodes.length <= 1 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 text-center">
              <p className="text-xs text-muted-foreground">
                Adicione uma <b>Mensagem</b> pela barra acima e conecte o <b>Início</b> a ela
                arrastando entre as bolinhas. Depois adicione <b>Espera</b> para follow-ups.
              </p>
            </div>
          )}
        </div>

        {selectedNode && (
          <NodeEditorPanel
            campaignId={campaignId}
            node={selectedNode}
            messages={messages}
            onChangeData={updateNodeData}
            onDeleteNode={deleteNode}
          />
        )}
      </div>

      {/* Salvar fluxo atual como modelo reutilizável */}
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Salvar como modelo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            Salva o fluxo salvo desta campanha (mensagens, esperas e conexões) como um modelo pra
            aplicar em outras campanhas depois.
          </p>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="template-name" className="text-xs">
                Nome
              </Label>
              <Input
                id="template-name"
                placeholder="ex: Fechamento delivery — padrão"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="template-description" className="text-xs">
                Descrição (opcional)
              </Label>
              <Textarea
                id="template-description"
                placeholder="Pra que serve esse fluxo?"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSaveTemplateOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => createTemplateMutation.mutate()}
              disabled={!templateName.trim() || createTemplateMutation.isPending}
            >
              {createTemplateMutation.isPending ? "Salvando…" : "Salvar modelo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aplicar um modelo salvo nesta campanha */}
      <Dialog open={applyTemplateOpen} onOpenChange={setApplyTemplateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Aplicar modelo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            Isso substitui o fluxo atual desta campanha pelo modelo escolhido.
          </p>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {templatesQuery.isLoading && (
              <p className="py-6 text-center text-xs text-muted-foreground">Carregando…</p>
            )}
            {templatesQuery.data?.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Nenhum modelo salvo ainda.
              </p>
            )}
            {templatesQuery.data?.map((template) => (
              <div
                key={template.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{template.name}</p>
                  {template.description && (
                    <p className="truncate text-xs text-muted-foreground">{template.description}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">{template.node_count} nós</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => setPendingApply(template)}>
                    Usar
                  </Button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(template)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Excluir modelo ${template.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação: aplicar modelo substitui o fluxo atual */}
      <AlertDialog
        open={Boolean(pendingApply)}
        onOpenChange={(open) => !open && setPendingApply(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar "{pendingApply?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              O fluxo atual desta campanha (mensagens, esperas e conexões) vai ser substituído pelo
              modelo. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingApply && applyTemplateMutation.mutate(pendingApply.id)}
              disabled={applyTemplateMutation.isPending}
            >
              {applyTemplateMutation.isPending ? "Aplicando…" : "Aplicar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação: excluir modelo */}
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso não afeta nenhuma campanha que já usa esse fluxo — só remove o modelo salvo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && deleteTemplateMutation.mutate(pendingDelete.id)}
              disabled={deleteTemplateMutation.isPending}
            >
              {deleteTemplateMutation.isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MessagesContext.Provider>
  );
}
