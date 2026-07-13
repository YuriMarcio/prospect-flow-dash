import { useRef } from "react";
import { FileText, MoreHorizontal, Trash2, Upload } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Block } from "@/lib/workspaceTypes";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileBlock({
  block,
  onSetFile,
  onRemove,
}: {
  block: Block;
  onSetFile: (meta: { name: string; sizeLabel: string }) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (!block.fileMeta) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border p-6 flex flex-col items-center gap-2 text-center">
        <Upload className="h-6 w-6 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Anexe um arquivo (PDF, DOCX, XLSX, ZIP…)</p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSetFile({ name: file.name, sizeLabel: formatBytes(file.size) });
          }}
        />
        <button onClick={() => inputRef.current?.click()} className="text-xs text-primary hover:underline">
          Escolher arquivo
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{block.fileMeta.name}</p>
        <p className="text-xs text-muted-foreground">{block.fileMeta.sizeLabel}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-7 w-7 grid place-items-center rounded hover:bg-accent">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
            Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
