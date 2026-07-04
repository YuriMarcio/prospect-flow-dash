import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Image as ImageIcon, Mic, Plus, Type, X } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createBotMessage,
  deleteBotMessage,
  listBotMessages,
  updateBotMessage,
  uploadBotMedia,
  type BotMessage,
  type MessageBlock,
} from "@/lib/prospector";

const STATUS_BADGE: Record<BotMessage["status"], { label: string; cls: string }> = {
  active: { label: "Ativa", cls: "bg-green-500/15 text-green-600" },
  draft: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  "ab-test": { label: "A/B", cls: "bg-yellow-500/15 text-yellow-600" },
};

interface MessageFormValue {
  title: string;
  blocks: MessageBlock[];
  reply_message_id: string | null;
}

function SortableBlockRow({
  block,
  onChange,
  onRemove,
}: {
  block: MessageBlock;
  onChange: (patch: Partial<MessageBlock>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id!,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 rounded-md border border-border bg-background p-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="mt-1 shrink-0 text-muted-foreground hover:text-foreground cursor-grab touch-none"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <div className="mt-1 shrink-0 text-muted-foreground">
        {block.type === "text" && <Type className="h-3.5 w-3.5" />}
        {block.type === "image" && <ImageIcon className="h-3.5 w-3.5" />}
        {block.type === "audio" && <Mic className="h-3.5 w-3.5" />}
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        {block.type === "text" && (
          <Textarea
            placeholder="Texto…"
            value={block.content}
            onChange={(e) => onChange({ content: e.target.value })}
            className="min-h-14 text-xs"
          />
        )}
        {block.type === "image" && (
          <>
            <img src={block.content} alt="" className="h-16 rounded border border-border object-cover" />
            <Input
              placeholder="Legenda (opcional)"
              value={block.caption ?? ""}
              onChange={(e) => onChange({ caption: e.target.value })}
              className="h-7 text-xs"
            />
          </>
        )}
        {block.type === "audio" && <audio controls src={block.content} className="h-8 w-full" />}
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function MessageForm({
  initial,
  otherMessages,
  saving,
  onSave,
  onCancel,
}: {
  initial: MessageFormValue;
  otherMessages: BotMessage[];
  saving: boolean;
  onSave: (value: MessageFormValue) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [blocks, setBlocks] = useState<MessageBlock[]>(initial.blocks);
  const [replyMessageId, setReplyMessageId] = useState<string | null>(initial.reply_message_id);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function addTextBlock() {
    setBlocks((prev) => [...prev, { id: crypto.randomUUID(), type: "text", content: "" }]);
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>, type: "image" | "audio") {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const { url } = await uploadBotMedia(file);
      setBlocks((prev) => [...prev, { id: crypto.randomUUID(), type, content: url, caption: "" }]);
    } catch {
      toast.error("Falha ao enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  function updateBlock(id: string, patch: Partial<MessageBlock>) {
    setBlocks((prev) => prev.map((block) => (block.id === id ? { ...block, ...patch } : block)));
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((block) => block.id !== id));
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    setBlocks((prev) => {
      const oldIndex = prev.findIndex((block) => block.id === e.active.id);
      const newIndex = prev.findIndex((block) => block.id === e.over!.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  const canSave = title.trim().length > 0 && blocks.length > 0 && blocks.every((b) => b.content.trim());

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <Input placeholder="Título da mensagem" value={title} onChange={(e) => setTitle(e.target.value)} />

      {blocks.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={blocks.map((b) => b.id!)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {blocks.map((block) => (
                <SortableBlockRow
                  key={block.id}
                  block={block}
                  onChange={(patch) => updateBlock(block.id!, patch)}
                  onRemove={() => removeBlock(block.id!)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={addTextBlock}
          className="flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Type className="h-3 w-3" /> Texto
        </button>
        <button
          type="button"
          disabled={uploading}
          onClick={() => imageInputRef.current?.click()}
          className="flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <ImageIcon className="h-3 w-3" /> Imagem
        </button>
        <button
          type="button"
          disabled={uploading}
          onClick={() => audioInputRef.current?.click()}
          className="flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <Mic className="h-3 w-3" /> Áudio
        </button>
        {uploading && <span className="text-[11px] text-muted-foreground">Enviando…</span>}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handleFileSelected(e, "image")}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => handleFileSelected(e, "audio")}
        />
      </div>

      <div className="space-y-1 pt-2 border-t border-border">
        <p className="text-[11px] text-muted-foreground">Se o lead responder, enviar automaticamente</p>
        <Select
          value={replyMessageId ?? "none"}
          onValueChange={(value) => setReplyMessageId(value === "none" ? null : value)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhuma</SelectItem>
            {otherMessages.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!canSave || saving}
          onClick={() => onSave({ title, blocks, reply_message_id: replyMessageId })}
          className="text-xs font-medium text-primary disabled:opacity-50"
        >
          Salvar mensagem
        </button>
      </div>
    </div>
  );
}

export function MessagesTab({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const messagesQuery = useQuery({
    queryKey: ["bot-messages", campaignId],
    queryFn: () => listBotMessages(campaignId),
  });
  const messages = messagesQuery.data ?? [];

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["bot-messages", campaignId] });
    queryClient.invalidateQueries({ queryKey: ["campaign-status", campaignId] });
  }

  const selectMutation = useMutation({
    mutationFn: (id: string) => updateBotMessage(id, { status: "active" }),
    onSuccess: invalidate,
  });

  const abLimitMutation = useMutation({
    mutationFn: ({ id, limit }: { id: string; limit: number }) =>
      updateBotMessage(id, { ab_limit: limit, status: limit > 0 ? "ab-test" : "draft" }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBotMessage,
    onSuccess: invalidate,
  });

  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof createBotMessage>[1]) => createBotMessage(campaignId, input),
    onSuccess: () => {
      invalidate();
      setCreating(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: MessageFormValue }) =>
      updateBotMessage(id, {
        title: value.title,
        blocks: value.blocks,
        reply_message_id: value.reply_message_id,
      }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Mensagem padrão</p>
        <p className="text-[11px] text-muted-foreground">
          enviada para todos, a menos que configure um A/B abaixo
        </p>
      </div>

      <div className="space-y-2">
        {messages.map((message) => {
          if (editingId === message.id) {
            return (
              <MessageForm
                key={message.id}
                initial={{
                  title: message.title,
                  blocks: message.bot_message_blocks.map((block) => ({
                    ...block,
                    id: block.id ?? crypto.randomUUID(),
                  })),
                  reply_message_id: message.reply_message_id,
                }}
                otherMessages={messages.filter((m) => m.id !== message.id)}
                saving={updateMutation.isPending}
                onCancel={() => setEditingId(null)}
                onSave={(value) => updateMutation.mutate({ id: message.id, value })}
              />
            );
          }

          const isActive = message.status === "active";
          const badge = STATUS_BADGE[message.status];
          const firstText = message.bot_message_blocks.find((b) => b.type === "text")?.content;
          const preview = firstText || `${message.bot_message_blocks.length} bloco(s) de mídia`;

          return (
            <div key={message.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => selectMutation.mutate(message.id)}
                  className={
                    isActive
                      ? "mt-0.5 h-4 w-4 shrink-0 rounded-full bg-primary grid place-items-center"
                      : "mt-0.5 h-4 w-4 shrink-0 rounded-full border border-border"
                  }
                  title="Usar como mensagem padrão"
                >
                  {isActive && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{message.title}</p>
                    <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${badge.cls}`}>
                      {badge.label}
                    </span>
                    {message.reply_message_id && (
                      <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-blue-500/15 text-blue-600">
                        resposta automática
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{preview}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingId(message.id)}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(message.id)}
                  className="text-[11px] text-muted-foreground hover:text-destructive"
                >
                  Excluir
                </button>
              </div>

              {!isActive && (
                <div className="flex items-center gap-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
                  <span>Usar para</span>
                  <input
                    type="number"
                    min={0}
                    defaultValue={message.ab_limit ?? 0}
                    onBlur={(e) =>
                      abLimitMutation.mutate({ id: message.id, limit: Number(e.target.value) || 0 })
                    }
                    className="w-12 rounded border border-border bg-background text-center outline-none"
                  />
                  <span>leads, então usar a padrão ({message.ab_used_count} já usados)</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {creating ? (
        <MessageForm
          initial={{ title: "", blocks: [], reply_message_id: null }}
          otherMessages={messages}
          saving={createMutation.isPending}
          onCancel={() => setCreating(false)}
          onSave={(value) =>
            createMutation.mutate({
              title: value.title,
              status: "draft",
              blocks: value.blocks,
              reply_message_id: value.reply_message_id,
            })
          }
        />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova mensagem
        </button>
      )}
    </div>
  );
}
