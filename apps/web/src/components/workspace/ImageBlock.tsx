import { useRef, useState } from "react";
import { AlignLeft, Download, ImageIcon, Maximize2, Minimize2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditableBlockText } from "./EditableBlockText";
import { cn } from "@/lib/utils";
import type { Block } from "@/lib/workspaceTypes";

const SIZE_CLASSES: Record<NonNullable<Block["imageSize"]>, string> = {
  small: "max-w-xs",
  medium: "max-w-xl",
  full: "w-full",
};

export function ImageBlock({
  block,
  onSetImage,
  onSetSize,
  onSetCaption,
  onRemoveImage,
  onCaptionKeyDown,
}: {
  block: Block;
  onSetImage: (url: string) => void;
  onSetSize: (size: NonNullable<Block["imageSize"]>) => void;
  onSetCaption: (text: string) => void;
  onRemoveImage: () => void;
  onCaptionKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!block.imageUrl) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border p-8 flex flex-col items-center gap-3 text-center">
        <ImageIcon className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Arraste uma imagem aqui, ou</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSetImage(URL.createObjectURL(file));
          }}
        />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          Escolher arquivo
        </Button>
        <div className="flex items-center gap-2 w-full max-w-xs">
          <Input
            placeholder="Colar URL da imagem…"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && urlInput.trim()) onSetImage(urlInput.trim());
            }}
            className="h-8 text-xs"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="group/image space-y-1.5">
      <div className={cn("relative rounded-lg overflow-hidden mx-auto", SIZE_CLASSES[block.imageSize ?? "full"])}>
        <img src={block.imageUrl} alt={block.caption ?? ""} className="w-full h-auto block" />
        <div className="absolute top-2 right-2 hidden group-hover/image:flex items-center gap-1 rounded-md bg-background/90 border border-border p-1 shadow-lg">
          <button
            title="Pequena"
            onClick={() => onSetSize("small")}
            className={cn("h-6 w-6 grid place-items-center rounded hover:bg-accent", block.imageSize === "small" && "bg-accent")}
          >
            <AlignLeft className="h-3 w-3" />
          </button>
          <button
            title="Média"
            onClick={() => onSetSize("medium")}
            className={cn("h-6 w-6 grid place-items-center rounded hover:bg-accent", block.imageSize === "medium" && "bg-accent")}
          >
            <Minimize2 className="h-3 w-3" />
          </button>
          <button
            title="Largura total"
            onClick={() => onSetSize("full")}
            className={cn(
              "h-6 w-6 grid place-items-center rounded hover:bg-accent",
              (!block.imageSize || block.imageSize === "full") && "bg-accent",
            )}
          >
            <Maximize2 className="h-3 w-3" />
          </button>
          <div className="w-px h-4 bg-border mx-0.5" />
          <button title="Substituir" onClick={() => fileInputRef.current?.click()} className="h-6 w-6 grid place-items-center rounded hover:bg-accent">
            <RefreshCw className="h-3 w-3" />
          </button>
          <a
            title="Baixar"
            href={block.imageUrl}
            download
            className="h-6 w-6 grid place-items-center rounded hover:bg-accent"
          >
            <Download className="h-3 w-3" />
          </a>
          <button title="Excluir" onClick={onRemoveImage} className="h-6 w-6 grid place-items-center rounded hover:bg-accent text-destructive">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSetImage(URL.createObjectURL(file));
          }}
        />
      </div>
      <EditableBlockText
        blockId={`${block.id}-caption`}
        content={block.caption ?? ""}
        placeholder="Adicionar uma legenda…"
        className="text-xs text-muted-foreground text-center"
        onInput={onSetCaption}
        onKeyDown={onCaptionKeyDown}
      />
    </div>
  );
}
