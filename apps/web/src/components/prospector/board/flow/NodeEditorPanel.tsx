import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createBotMessage,
  updateBotMessage,
  type BotMessage,
  type MessageBlock,
} from "@/lib/prospector";
import type { FlowNodeConfig, FlowVariant } from "@/lib/flows";
import { MessageBlocksEditor } from "../MessageBlocksEditor";
import { KANBAN_COLUMN_OPTIONS, type CanvasNode } from "./nodes";

function withBlockIds(blocks: MessageBlock[]): MessageBlock[] {
  return blocks.map((block) => ({ ...block, id: block.id ?? crypto.randomUUID() }));
}

/** Editor da mensagem apontada por um nó (título + blocos), com salvar próprio. */
function MessageEditor({
  campaignId,
  message,
  onSaved,
}: {
  campaignId: string;
  message: BotMessage | null;
  onSaved: (messageId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(message?.title ?? "");
  const [blocks, setBlocks] = useState<MessageBlock[]>(
    withBlockIds(message?.bot_message_blocks ?? []),
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (message) {
        return updateBotMessage(message.id, { title, blocks });
      }
      return createBotMessage(campaignId, { title, status: "draft", blocks });
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["bot-messages", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-status", campaignId] });
      onSaved(saved.id);
      toast.success("Mensagem salva.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const canSave =
    title.trim().length > 0 && blocks.length > 0 && blocks.every((b) => b.content.trim());

  return (
    <div className="space-y-2">
      <Input
        placeholder="Título da mensagem"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-8 text-xs"
      />
      <MessageBlocksEditor blocks={blocks} onChange={setBlocks} />
      <Button
        size="sm"
        className="w-full"
        disabled={!canSave || saveMutation.isPending}
        onClick={() => saveMutation.mutate()}
      >
        {saveMutation.isPending ? "Salvando…" : message ? "Salvar mensagem" : "Criar mensagem"}
      </Button>
    </div>
  );
}

function VariantsEditor({
  variants,
  messages,
  currentMessageId,
  onChange,
}: {
  variants: FlowVariant[];
  messages: BotMessage[];
  currentMessageId: string | null;
  onChange: (next: FlowVariant[]) => void;
}) {
  const available = messages.filter((m) => m.id !== currentMessageId);

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-medium">Teste A/B</p>
        <p className="text-[10px] text-muted-foreground">
          Cada variante é usada até o limite de leads, depois volta pra mensagem principal.
        </p>
      </div>

      {variants.map((variant, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <Select
            value={variant.message_id || undefined}
            onValueChange={(value) =>
              onChange(variants.map((v, i) => (i === index ? { ...v, message_id: value } : v)))
            }
          >
            <SelectTrigger className="h-7 flex-1 text-xs">
              <SelectValue placeholder="Escolher mensagem…" />
            </SelectTrigger>
            <SelectContent>
              {available.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={0}
            value={variant.limit ?? 0}
            onChange={(e) =>
              onChange(
                variants.map((v, i) =>
                  i === index ? { ...v, limit: Math.max(0, Number(e.target.value) || 0) } : v,
                ),
              )
            }
            className="h-7 w-16 text-xs text-center"
            title="Limite de leads"
          />
          <button
            type="button"
            onClick={() => onChange(variants.filter((_, i) => i !== index))}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...variants, { message_id: "", limit: 30 }])}
        className="w-full rounded-md border border-dashed border-border py-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        + Adicionar variante
      </button>
    </div>
  );
}

/**
 * Painel lateral de edição do nó selecionado no canvas. Mudanças de config
 * são aplicadas no estado local do canvas (persistem no "Salvar fluxo");
 * mensagens são salvas na hora pelos endpoints existentes.
 */
export function NodeEditorPanel({
  campaignId,
  node,
  messages,
  onChangeData,
  onDeleteNode,
}: {
  campaignId: string;
  node: CanvasNode;
  messages: BotMessage[];
  onChangeData: (id: string, patch: { config?: FlowNodeConfig; messageId?: string | null }) => void;
  onDeleteNode: (id: string) => void;
}) {
  const config = node.data.config;
  const message = node.data.messageId
    ? (messages.find((m) => m.id === node.data.messageId) ?? null)
    : null;
  const [creatingNew, setCreatingNew] = useState(false);

  return (
    <div className="flex h-full w-[360px] shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="text-xs font-semibold">
          {node.type === "start" && "Início do fluxo"}
          {node.type === "message" && "Nó de mensagem"}
          {node.type === "wait" && "Nó de espera"}
          {node.type === "intent_router" && "Classificação por IA"}
          {node.type === "action" && "Nó de ação"}
        </p>
        {node.type !== "start" && (
          <button
            type="button"
            onClick={() => onDeleteNode(node.id)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" /> Excluir nó
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {node.type === "start" && (
          <p className="text-xs text-muted-foreground">
            Ponto de partida da campanha. Conecte a saída à primeira mensagem que os leads vão
            receber.
          </p>
        )}

        {node.type === "message" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Mensagem deste nó</Label>
              <Select
                value={creatingNew ? "new" : (node.data.messageId ?? undefined)}
                onValueChange={(value) => {
                  if (value === "new") {
                    setCreatingNew(true);
                  } else {
                    setCreatingNew(false);
                    onChangeData(node.id, { messageId: value });
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Escolher ou criar…" />
                </SelectTrigger>
                <SelectContent>
                  {messages.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.title}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">+ Criar nova mensagem</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(creatingNew || message) && (
              <MessageEditor
                key={creatingNew ? "new" : message!.id}
                campaignId={campaignId}
                message={creatingNew ? null : message}
                onSaved={(messageId) => {
                  setCreatingNew(false);
                  onChangeData(node.id, { messageId });
                }}
              />
            )}

            <div className="border-t border-border pt-3">
              <VariantsEditor
                variants={config.variants ?? []}
                messages={messages}
                currentMessageId={node.data.messageId}
                onChange={(variants) => onChangeData(node.id, { config: { ...config, variants } })}
              />
            </div>
          </>
        )}

        {node.type === "wait" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Fazer follow-up após quantas horas sem resposta?</Label>
            <Input
              type="number"
              min={0}
              placeholder="vazio = aguardar sem prazo"
              value={config.hours ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                onChangeData(node.id, {
                  config: { ...config, hours: raw === "" ? null : Math.max(0, Number(raw) || 0) },
                });
              }}
              className="h-8 text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Se o lead responder antes, segue pela saída "respondeu". Vencido o prazo, segue pela
              saída "sem resposta" (ex.: 48 = follow-up em 2 dias). Vazio desativa o follow-up.
            </p>
          </div>
        )}

        {node.type === "intent_router" && (
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>
              Quando o lead responde, a IA classifica a intenção e o fluxo segue pela saída
              correspondente. Intenções sem conexão seguem pelo <b>fallback</b> (obrigatório).
            </p>
            <p>
              Ative a classificação por IA na aba <b>IA & respostas</b>. Sem IA, tudo segue pelo
              fallback.
            </p>
            <p>
              O conteúdo respondido automaticamente por intenção também é configurado na aba{" "}
              <b>IA & respostas</b> — este nó só decide o caminho do lead no fluxo.
            </p>
          </div>
        )}

        {node.type === "action" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Ação</Label>
              <Select
                value={config.kind ?? "end"}
                onValueChange={(value) =>
                  onChangeData(node.id, {
                    config: { ...config, kind: value as "move_kanban" | "end" },
                  })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="end">Encerrar fluxo</SelectItem>
                  <SelectItem value="move_kanban">Mover no Kanban</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.kind === "move_kanban" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Mover lead para</Label>
                <Select
                  value={config.column_id ?? undefined}
                  onValueChange={(value) =>
                    onChangeData(node.id, { config: { ...config, column_id: value } })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Escolher coluna…" />
                  </SelectTrigger>
                  <SelectContent>
                    {KANBAN_COLUMN_OPTIONS.map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        {column.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
