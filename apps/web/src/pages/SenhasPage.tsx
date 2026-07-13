import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock, Plus, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useVaultAuthStore } from "@/store/vaultAuth";
import { listVaultEntries } from "@/lib/vaultApi";
import { VaultUnlockOverlay } from "@/components/vault/VaultUnlockOverlay";
import { VaultEntryList } from "@/components/vault/VaultEntryList";
import { VaultEntryDetail } from "@/components/vault/VaultEntryDetail";
import { NewEntryDialog } from "@/components/vault/NewEntryDialog";
import { SessionPanel } from "@/components/vault/SessionPanel";

export function SenhasPage() {
  const isUnlocked = useVaultAuthStore((s) => s.isUnlocked());

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const entriesQuery = useQuery({
    queryKey: ["vault-entries"],
    queryFn: listVaultEntries,
    enabled: isUnlocked,
  });

  const entries = entriesQuery.data ?? [];

  return (
    <div className="p-6 space-y-4 h-[calc(100vh-4rem)] flex flex-col animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary grid place-items-center">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Cofre de Senhas</h1>
            <p className="text-sm text-muted-foreground">Gerencie com segurança suas senhas, logins e chaves de API.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="outline" disabled>
                    <Share2 className="h-4 w-4" />
                    Compartilhar cofre
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Em breve</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            onClick={() => {
              setSelectedId(null);
              setDialogOpen(true);
            }}
            disabled={!isUnlocked}
          >
            <Plus className="h-4 w-4" />
            Nova entrada
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[560px_1fr_280px] gap-4">
        <VaultEntryList
          entries={entries}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNewEntry={() => {
            setSelectedId(null);
            setDialogOpen(true);
          }}
        />

        {selectedId ? (
          <VaultEntryDetail entryId={selectedId} onDeleted={() => setSelectedId(null)} onEdit={() => setDialogOpen(true)} />
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-center text-sm text-muted-foreground">
            Selecione uma entrada para ver os detalhes.
          </div>
        )}

        <div className="hidden xl:block">{isUnlocked && <SessionPanel />}</div>
      </div>

      <NewEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} entry={undefined} onSaved={(id) => setSelectedId(id)} />

      {!isUnlocked && <VaultUnlockOverlay />}
    </div>
  );
}
