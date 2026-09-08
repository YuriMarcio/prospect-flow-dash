import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, ExternalLink, Expand, FileText, Loader2, MoreHorizontal, Trash2, Upload } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { uploadWorkspaceFile } from "@/lib/workspaceApi";
import { isGoogleDriveConfigured, pickGoogleDriveFile } from "@/lib/googleDrivePicker";
import { formatBytes } from "@/lib/workspaceUtils";
import type { Block } from "@/lib/workspaceTypes";

const PDF_MIME = "application/pdf";

// Link do Google Drive é /view (bom pra abrir no próprio Drive, com
// comentários etc.), mas o Drive só permite embedar em iframe na variante
// /preview — sem essa troca o preview inline simplesmente não carrega.
function toEmbeddableUrl(fileMeta: NonNullable<Block["fileMeta"]>): string | null {
  if (!fileMeta.url) return null;
  if (fileMeta.source === "gdrive") return fileMeta.url.replace(/\/view(\?.*)?$/, "/preview");
  return fileMeta.url;
}

export function FileBlock({
  block,
  onSetFile,
  onRemove,
}: {
  block: Block;
  onSetFile: (meta: NonNullable<Block["fileMeta"]>) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  async function handleFileSelected(file: File) {
    setUploading(true);
    try {
      const result = await uploadWorkspaceFile(file);
      onSetFile({
        name: result.name,
        sizeLabel: formatBytes(result.sizeBytes),
        url: result.url,
        mimeType: result.mimeType,
        source: "upload",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar arquivo.");
    } finally {
      setUploading(false);
    }
  }

  async function handlePickFromDrive() {
    try {
      const picked = await pickGoogleDriveFile();
      if (!picked) return;
      onSetFile({
        name: picked.name,
        sizeLabel: picked.sizeBytes ? formatBytes(picked.sizeBytes) : "Google Drive",
        url: picked.url,
        mimeType: picked.mimeType,
        source: "gdrive",
        iconUrl: picked.iconUrl,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao abrir o Google Drive.");
    }
  }

  if (!block.fileMeta) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation(); // não deixa a página criar outro bloco de arquivo pro mesmo drop
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFileSelected(file);
        }}
        className={`rounded-lg border-2 border-dashed p-6 flex flex-col items-center gap-3 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
        ) : (
          <Upload className="h-6 w-6 text-muted-foreground" />
        )}
        <p className="text-xs text-muted-foreground">Anexe um arquivo (PDF, DOCX, XLSX…) ou traga do Google Drive</p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelected(file);
            e.target.value = "";
          }}
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
            Escolher arquivo
          </Button>
          {isGoogleDriveConfigured() && (
            <Button variant="outline" size="sm" disabled={uploading} onClick={handlePickFromDrive}>
              Google Drive
            </Button>
          )}
        </div>
      </div>
    );
  }

  const { fileMeta } = block;
  const isPdf = fileMeta.mimeType === PDF_MIME;
  const embeddableUrl = isPdf ? toEmbeddableUrl(fileMeta) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        {fileMeta.iconUrl ? (
          <img src={fileMeta.iconUrl} alt="" className="h-5 w-5 shrink-0" />
        ) : (
          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{fileMeta.name}</p>
          <p className="text-xs text-muted-foreground">
            {fileMeta.sizeLabel}
            {fileMeta.source === "gdrive" && " · Google Drive"}
          </p>
        </div>
        {isPdf && embeddableUrl && (
          <button
            title="Abrir"
            onClick={() => setViewerOpen(true)}
            className="h-7 w-7 grid place-items-center rounded hover:bg-accent shrink-0"
          >
            <Expand className="h-3.5 w-3.5" />
          </button>
        )}
        {fileMeta.url && (
          <a
            href={fileMeta.url}
            target="_blank"
            rel="noreferrer"
            title={fileMeta.source === "gdrive" ? "Abrir no Google Drive" : "Baixar"}
            className="h-7 w-7 grid place-items-center rounded hover:bg-accent shrink-0"
          >
            {fileMeta.source === "gdrive" ? <ExternalLink className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
          </a>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-7 w-7 grid place-items-center rounded hover:bg-accent shrink-0">
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
      {isPdf && embeddableUrl && (
        <iframe src={embeddableUrl} title={fileMeta.name} className="w-full h-125 rounded-lg border border-border" />
      )}

      {isPdf && embeddableUrl && (
        <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
          <DialogContent className="flex h-[90vh] w-[90vw] max-w-5xl flex-col">
            <DialogHeader>
              <DialogTitle className="truncate pr-6">{fileMeta.name}</DialogTitle>
            </DialogHeader>
            <iframe src={embeddableUrl} title={fileMeta.name} className="flex-1 rounded-lg border border-border" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
