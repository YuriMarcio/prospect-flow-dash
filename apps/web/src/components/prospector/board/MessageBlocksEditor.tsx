import { useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Image as ImageIcon, Mic, Type, X } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { uploadBotMedia, type MessageBlock } from "@/lib/prospector";

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
            <img
              src={block.content}
              alt=""
              className="h-16 rounded border border-border object-cover"
            />
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

/**
 * Editor de blocos de mensagem (texto/imagem/áudio), reordenável por drag,
 * com upload de mídia. Componente controlado: recebe os blocos e avisa cada
 * mudança — quem usa decide quando persistir.
 */
export function MessageBlocksEditor({
  blocks,
  onChange,
}: {
  blocks: MessageBlock[];
  onChange: (next: MessageBlock[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function addTextBlock() {
    onChange([...blocks, { id: crypto.randomUUID(), type: "text", content: "" }]);
  }

  async function handleFileSelected(
    e: React.ChangeEvent<HTMLInputElement>,
    type: "image" | "audio",
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const { url } = await uploadBotMedia(file);
      onChange([...blocks, { id: crypto.randomUUID(), type, content: url, caption: "" }]);
    } catch {
      toast.error("Falha ao enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  function updateBlock(id: string, patch: Partial<MessageBlock>) {
    onChange(blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)));
  }

  function removeBlock(id: string) {
    onChange(blocks.filter((block) => block.id !== id));
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIndex = blocks.findIndex((block) => block.id === e.active.id);
    const newIndex = blocks.findIndex((block) => block.id === e.over!.id);
    onChange(arrayMove(blocks, oldIndex, newIndex));
  }

  return (
    <div className="space-y-2">
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
    </div>
  );
}
