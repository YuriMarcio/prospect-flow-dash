import { createContext, useContext } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Clock, Flag, GitBranch, MessageSquare, Zap } from "lucide-react";
import { INTENTS, INTENT_LABELS, type FlowNodeConfig, type Intent } from "@/lib/flows";
import type { BotMessage } from "@/lib/prospector";

export interface CanvasNodeData extends Record<string, unknown> {
  config: FlowNodeConfig;
  messageId: string | null;
}

export type CanvasNode = Node<CanvasNodeData>;

/** Mapa de mensagens da campanha, pros nós renderizarem título/preview. */
export const MessagesContext = createContext<Map<string, BotMessage>>(new Map());

export const KANBAN_COLUMN_OPTIONS = [
  { id: "col-1", label: "A Prospectar" },
  { id: "col-2", label: "Em Prospecção" },
  { id: "col-3", label: "Negociação" },
  { id: "col-4", label: "Venda Fechada" },
  { id: "col-5", label: "Perdido" },
];

function nodeShell(selected: boolean | undefined, accent: string) {
  return `rounded-lg border-2 bg-card shadow-sm min-w-44 max-w-56 text-left ${
    selected ? "border-primary" : accent
  }`;
}

export function StartNode({ selected }: NodeProps<CanvasNode>) {
  return (
    <div className={nodeShell(selected, "border-green-500/50")}>
      <div className="flex items-center gap-1.5 px-3 py-2">
        <Zap className="h-3.5 w-3.5 text-green-500" />
        <span className="text-xs font-semibold">Início</span>
      </div>
      <div className="relative border-t border-border px-3 py-1.5">
        <span className="text-[10px] text-muted-foreground">primeira mensagem</span>
        <Handle type="source" position={Position.Right} id="next" className="!bg-green-500" />
      </div>
    </div>
  );
}

export function MessageNode({ data, selected }: NodeProps<CanvasNode>) {
  const messages = useContext(MessagesContext);
  const message = data.messageId ? messages.get(data.messageId) : null;
  const variants = data.config.variants ?? [];
  const firstText = message?.bot_message_blocks.find((b) => b.type === "text")?.content;
  const preview =
    firstText || (message ? `${message.bot_message_blocks.length} bloco(s) de mídia` : null);

  return (
    <div className={nodeShell(selected, "border-blue-500/50")}>
      <Handle type="target" position={Position.Left} className="!bg-blue-500" />
      <div className="flex items-center gap-1.5 px-3 py-2">
        <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-xs font-semibold truncate">{message?.title ?? "Mensagem"}</span>
        {variants.length > 0 && (
          <span className="ml-auto shrink-0 rounded-full bg-yellow-500/15 px-1.5 text-[9px] text-yellow-600">
            A/B ×{variants.length + 1}
          </span>
        )}
      </div>
      <div className="relative border-t border-border px-3 py-1.5">
        {preview ? (
          <p className="text-[10px] text-muted-foreground line-clamp-2">{preview}</p>
        ) : (
          <p className="text-[10px] text-destructive">sem mensagem — clique para configurar</p>
        )}
        <Handle type="source" position={Position.Right} id="next" className="!bg-blue-500" />
      </div>
    </div>
  );
}

export function WaitNode({ data, selected }: NodeProps<CanvasNode>) {
  const hours = data.config.hours ?? null;
  return (
    <div className={nodeShell(selected, "border-amber-500/50")}>
      <Handle type="target" position={Position.Left} className="!bg-amber-500" />
      <div className="flex items-center gap-1.5 px-3 py-2">
        <Clock className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs font-semibold">Aguardar resposta</span>
      </div>
      <div className="relative border-t border-border px-3 py-1.5">
        <span className="text-[10px] text-muted-foreground">se responder →</span>
        <Handle type="source" position={Position.Right} id="replied" className="!bg-green-500" />
      </div>
      <div className="relative border-t border-border px-3 py-1.5">
        <span className="text-[10px] text-muted-foreground">
          {hours === null ? "sem prazo (não faz follow-up)" : `sem resposta após ${hours}h →`}
        </span>
        <Handle type="source" position={Position.Right} id="no_reply" className="!bg-amber-500" />
      </div>
    </div>
  );
}

export function IntentRouterNode({ selected }: NodeProps<CanvasNode>) {
  return (
    <div className={nodeShell(selected, "border-purple-500/50")}>
      <Handle type="target" position={Position.Left} className="!bg-purple-500" />
      <div className="flex items-center gap-1.5 px-3 py-2">
        <GitBranch className="h-3.5 w-3.5 text-purple-500" />
        <span className="text-xs font-semibold">Classificar resposta (IA)</span>
      </div>
      {INTENTS.map((intent) => (
        <div key={intent} className="relative border-t border-border px-3 py-1">
          <span className="text-[10px] text-muted-foreground">
            {INTENT_LABELS[intent as Intent]}
          </span>
          <Handle type="source" position={Position.Right} id={intent} className="!bg-purple-500" />
        </div>
      ))}
      <div className="relative border-t border-border px-3 py-1">
        <span className="text-[10px] font-medium text-muted-foreground">
          Fallback (obrigatório)
        </span>
        <Handle type="source" position={Position.Right} id="fallback" className="!bg-purple-500" />
      </div>
    </div>
  );
}

export function ActionNode({ data, selected }: NodeProps<CanvasNode>) {
  const config = data.config;
  const label =
    config.kind === "move_kanban"
      ? `Mover p/ ${KANBAN_COLUMN_OPTIONS.find((c) => c.id === config.column_id)?.label ?? "coluna"}`
      : "Encerrar fluxo";

  return (
    <div className={nodeShell(selected, "border-rose-500/50")}>
      <Handle type="target" position={Position.Left} className="!bg-rose-500" />
      <div className="flex items-center gap-1.5 px-3 py-2">
        <Flag className="h-3.5 w-3.5 text-rose-500" />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      {config.kind !== "end" && (
        <div className="relative border-t border-border px-3 py-1.5">
          <span className="text-[10px] text-muted-foreground">depois →</span>
          <Handle type="source" position={Position.Right} id="next" className="!bg-rose-500" />
        </div>
      )}
    </div>
  );
}

export const nodeTypes = {
  start: StartNode,
  message: MessageNode,
  wait: WaitNode,
  intent_router: IntentRouterNode,
  action: ActionNode,
};

/** Rótulo da aresta conforme a porta de saída (didático no canvas). */
export function edgeLabelForHandle(handle: string | null | undefined): string | undefined {
  if (!handle || handle === "next") return undefined;
  if (handle === "replied") return "respondeu";
  if (handle === "no_reply") return "sem resposta";
  if (handle === "fallback") return "fallback";
  return INTENT_LABELS[handle as Intent] ?? handle;
}
