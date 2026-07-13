import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createVaultEntry, updateVaultEntry, type VaultEntryDetail } from "@/lib/vaultApi";

const CATEGORY_SUGGESTIONS = ["Redes Sociais", "Plataformas de Ads", "Tecnologias", "E-mails", "Serviços", "Bancos", "Outros"];

export function NewEntryDialog({
  open,
  onOpenChange,
  entry,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry?: VaultEntryDetail;
  onSaved: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Outros");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(entry?.title ?? "");
      setCategory(entry?.category ?? "Outros");
      setUsername(entry?.username ?? "");
      setPassword("");
      setUrl(entry?.url ?? "");
      setNotes(entry?.notes ?? "");
    }
  }, [open, entry]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: title.trim(),
        category: category.trim() || "Outros",
        username: username.trim() || null,
        url: url.trim() || null,
        notes: notes.trim() || null,
        ...(password ? { password } : {}),
      };
      return entry ? updateVaultEntry(entry.id, payload) : createVaultEntry(payload);
    },
    onSuccess: (result) => {
      toast.success(entry ? "Entrada atualizada." : "Entrada criada.");
      queryClient.invalidateQueries({ queryKey: ["vault-entries"] });
      if (entry) queryClient.invalidateQueries({ queryKey: ["vault-entry", entry.id] });
      onOpenChange(false);
      onSaved(result.id);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? "Editar entrada" : "Nova entrada"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-medium">Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Google Ads" required />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Categoria</Label>
              <Input list="vault-category-list" value={category} onChange={(e) => setCategory(e.target.value)} />
              <datalist id="vault-category-list">
                {CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Email / Usuário</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{entry ? "Nova senha (opcional)" : "Senha"}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={entry ? "Deixe em branco para manter" : ""}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">URL de acesso</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-medium">Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
