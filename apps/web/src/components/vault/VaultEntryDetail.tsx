import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  addVaultApiKey,
  deleteVaultApiKey,
  deleteVaultAttachment,
  deleteVaultEntry,
  getVaultAttachmentUrl,
  getVaultEntry,
  toggleFavoriteVaultEntry,
  updateVaultEntry,
  uploadVaultAttachment,
} from "@/lib/vaultApi";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

export function VaultEntryDetail({
  entryId,
  onDeleted,
  onEdit,
}: {
  entryId: string;
  onDeleted: () => void;
  onEdit: () => void;
}) {
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [addingKey, setAddingKey] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const entryQuery = useQuery({
    queryKey: ["vault-entry", entryId],
    queryFn: () => getVaultEntry(entryId),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["vault-entry", entryId] });
    queryClient.invalidateQueries({ queryKey: ["vault-entries"] });
  }

  const favoriteMutation = useMutation({
    mutationFn: (favorite: boolean) => toggleFavoriteVaultEntry(entryId, favorite),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteVaultEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vault-entries"] });
      onDeleted();
    },
  });

  const addTagMutation = useMutation({
    mutationFn: (tags: string[]) => updateVaultEntry(entryId, { tags }),
    onSuccess: () => {
      invalidate();
      setAddingTag(false);
      setNewTag("");
    },
  });

  const addKeyMutation = useMutation({
    mutationFn: () => addVaultApiKey(entryId, newKeyLabel, newKeyValue),
    onSuccess: () => {
      invalidate();
      setAddingKey(false);
      setNewKeyLabel("");
      setNewKeyValue("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao adicionar chave."),
  });

  const deleteKeyMutation = useMutation({
    mutationFn: (keyId: string) => deleteVaultApiKey(entryId, keyId),
    onSuccess: invalidate,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadVaultAttachment(entryId, file),
    onSuccess: invalidate,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao enviar anexo."),
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attId: string) => deleteVaultAttachment(entryId, attId),
    onSuccess: invalidate,
  });

  async function handleDownload(attId: string) {
    try {
      const { url } = await getVaultAttachmentUrl(entryId, attId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao baixar anexo.");
    }
  }

  function copy(value: string, label: string) {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  }

  if (entryQuery.isLoading) {
    return <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  const entry = entryQuery.data;
  if (!entry) {
    return <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Entrada não encontrada.</div>;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5 overflow-y-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{entry.title}</h2>
          <span className="inline-block mt-1 text-[11px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
            {entry.category}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={() => favoriteMutation.mutate(!entry.favorite)}>
            <Star className={entry.favorite ? "h-4 w-4 fill-warning text-warning" : "h-4 w-4"} />
          </Button>
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir esta entrada?</AlertDialogTitle>
                <AlertDialogDescription>
                  Essa ação não pode ser desfeita. Senha, chaves de API e anexos dessa entrada serão apagados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteMutation.mutate()}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {entry.username && (
        <Field label="Email / Usuário">
          <div className="flex items-center gap-2">
            <p className="text-sm flex-1 truncate">{entry.username}</p>
            <Button variant="ghost" size="icon" onClick={() => copy(entry.username!, "Usuário")}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Field>
      )}

      {entry.password && (
        <Field label="Senha">
          <div className="flex items-center gap-2">
            <p className="text-sm flex-1 font-mono truncate">{showPassword ? entry.password : "•".repeat(14)}</p>
            <Button variant="ghost" size="icon" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => copy(entry.password!, "Senha")}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Field>
      )}

      {entry.url && (
        <Field label="URL de acesso">
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1.5"
          >
            {entry.url}
            <ExternalLink className="h-3 w-3" />
          </a>
        </Field>
      )}

      {entry.notes && (
        <Field label="Notas">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{entry.notes}</p>
        </Field>
      )}

      <Field label="Tags">
        <div className="flex flex-wrap items-center gap-1.5">
          {entry.tags.map((tag) => (
            <span key={tag} className="text-[11px] font-medium bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
              {tag}
              <button
                onClick={() => addTagMutation.mutate(entry.tags.filter((t) => t !== tag))}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          {addingTag ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTag.trim()) addTagMutation.mutate([...entry.tags, newTag.trim()]);
                  if (e.key === "Escape") setAddingTag(false);
                }}
                className="h-7 w-28 text-xs"
                placeholder="nova tag"
              />
            </div>
          ) : (
            <button
              onClick={() => setAddingTag(true)}
              className="h-6 w-6 rounded-full border border-dashed border-border grid place-items-center text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
        </div>
      </Field>

      <Field label="Anexos">
        <div className="space-y-2">
          {entry.attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{att.filename}</p>
                <p className="text-[10px] text-muted-foreground">{formatBytes(att.sizeBytes)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDownload(att.id)}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => deleteAttachmentMutation.mutate(att.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMutation.mutate(file);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
            <Paperclip className="h-3.5 w-3.5" />
            {uploadMutation.isPending ? "Enviando…" : "Adicionar anexo"}
          </Button>
        </div>
      </Field>

      <Field label="Chaves de API">
        <div className="space-y-2">
          {entry.apiKeys.map((key) => (
            <div key={key.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">{key.label}</p>
                <p className="text-xs font-mono text-muted-foreground truncate">{"•".repeat(16)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => copy(key.value, key.label)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteKeyMutation.mutate(key.id)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          {addingKey ? (
            <div className="space-y-2 rounded-lg border border-border p-2">
              <Input placeholder="Rótulo" value={newKeyLabel} onChange={(e) => setNewKeyLabel(e.target.value)} className="h-8 text-xs" />
              <Input placeholder="Valor" value={newKeyValue} onChange={(e) => setNewKeyValue(e.target.value)} className="h-8 text-xs font-mono" />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => addKeyMutation.mutate()} disabled={addKeyMutation.isPending}>
                  Salvar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAddingKey(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAddingKey(true)}>
              <Plus className="h-3.5 w-3.5" />
              Adicionar chave
            </Button>
          )}
        </div>
      </Field>

      <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-2 border-t border-border">
        <span>Criado em {formatDate(entry.createdAt)}</span>
        <span>Atualizado em {formatDate(entry.updatedAt)}</span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
