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
  const [region, setRegion] = useState("");

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: listUsers, enabled: open });

  const createMutation = useMutation({
    mutationFn: () => createCampaign({ name: name.trim(), ownerUserId, region: region.trim() || null }),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ["prospecting-campaigns"] });
      onCreated(campaign);
      onOpenChange(false);
      setName("");
      setOwnerUserId("");
      setRegion("");
    },
  });

  const canCreate = name.trim().length > 0 && Boolean(ownerUserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent mobileSheet className="sm:max-w-sm">
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
              className="max-sm:h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Território (opcional)</Label>
            <Input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="ex: Ilha do Governador"
              className="max-sm:h-11"
            />
            <p className="text-[11px] text-muted-foreground">
              A região que essa campanha cuida. Aparece embaixo do nome e já vem preenchida nas capturas.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Responsável pelo envio</Label>
            <Select value={ownerUserId} onValueChange={setOwnerUserId}>
              <SelectTrigger className="max-sm:h-11">
                <SelectValue placeholder="Quem vai enviar as mensagens?" />
              </SelectTrigger>
              <SelectContent>
                {(usersQuery.data ?? []).map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.username === myUsername
                      ? "Eu"
                      : (user.name ?? user.username ?? user.email ?? "—")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              O WhatsApp dessa pessoa precisa já estar conectado pra campanha rodar.
            </p>
          </div>

          <p className="text-xs text-muted-foreground pt-1 border-t border-border">
            Depois de criar, cadastre ou capture os leads da região e escolha com quais o bot vai
            falar. Agenda e mensagens ficam com valores padrão — ajuste em "Configurar campanha".
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" className="max-sm:h-11" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="max-sm:h-11"
            onClick={() => createMutation.mutate()}
            disabled={!canCreate || createMutation.isPending}
          >
            {createMutation.isPending ? "Criando…" : "Criar campanha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
