import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Rocket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCampaign, type ProspectingCampaign } from "@/lib/prospector";
import { listUsers } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export function NewCampaignModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (campaign: ProspectingCampaign) => void;
}) {
  const queryClient = useQueryClient();
  const myUsername = useAuthStore((s) => s.username);
  const [name, setName] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: listUsers, enabled: open });

  const createMutation = useMutation({
    mutationFn: () => createCampaign({ name: name.trim(), ownerUserId }),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      onCreated(campaign);
      onOpenChange(false);
      setName("");
      setOwnerUserId("");
    },
  });

  const canCreate = name.trim().length > 0 && Boolean(ownerUserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            Nova campanha
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome da campanha</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Delivery Ipanema"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Responsável pelo envio</Label>
            <Select value={ownerUserId} onValueChange={setOwnerUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Quem vai enviar as mensagens?" />
              </SelectTrigger>
              <SelectContent>
                {(usersQuery.data ?? []).map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.username === myUsername ? "Eu" : user.name ?? user.username ?? user.email ?? "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              O WhatsApp dessa pessoa precisa já estar conectado pra campanha rodar.
            </p>
          </div>

          <p className="text-xs text-muted-foreground pt-1 border-t border-border">
            Agenda, filtros e mensagens ficam com valores padrão — ajuste em "Configurar campanha"
            depois de criar.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => createMutation.mutate()} disabled={!canCreate || createMutation.isPending}>
            {createMutation.isPending ? "Criando…" : "Criar campanha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
