import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  updateCampaign,
  type CampaignNotificationConfig,
  type ProspectingCampaign,
} from "@/lib/prospector";

const DEFAULT_CONFIG: CampaignNotificationConfig = {
  enabled: false,
  phone: null,
  notify_on: ["high_readiness"],
  cooldown_minutes: 60,
};

export function NotificationsTab({ campaign }: { campaign: ProspectingCampaign }) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<CampaignNotificationConfig>(
    campaign.notification_config ?? DEFAULT_CONFIG,
  );

  useEffect(() => {
    setConfig(campaign.notification_config ?? DEFAULT_CONFIG);
  }, [campaign.notification_config]);

  const saveMutation = useMutation({
    mutationFn: () => updateCampaign(campaign.id, { notification_config: config }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", campaign.id] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Notificações salvas.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const notifyMode = config.notify_on.includes("reply") ? "reply" : "high_readiness";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="rounded-lg border border-border bg-card p-3 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-2">
            <Bell className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <Label className="text-xs">Avisar no meu WhatsApp quando um lead responder</Label>
              <p className="text-[11px] text-muted-foreground">
                A mensagem sai pela própria instância conectada da campanha, com nome do lead,
                intenção detectada e o texto da resposta.
              </p>
            </div>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
          />
        </div>

        <div className="space-y-1.5 border-t border-border pt-3">
          <Label className="text-xs">Número de destino</Label>
          <Input
            placeholder="Vazio = telefone do seu perfil"
            value={config.phone ?? ""}
            onChange={(e) => setConfig({ ...config, phone: e.target.value.trim() || null })}
            className="h-8 text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            Formato com DDI, ex: 5541999999999. Sem preencher, usa o telefone cadastrado no seu
            perfil.
          </p>
        </div>

        <div className="space-y-1.5 border-t border-border pt-3">
          <Label className="text-xs">Quando avisar</Label>
          <RadioGroup
            value={notifyMode}
            onValueChange={(value) =>
              setConfig({
                ...config,
                notify_on: value === "reply" ? ["reply"] : ["high_readiness"],
              })
            }
            className="gap-1.5"
          >
            <label className="flex items-center gap-2 text-xs">
              <RadioGroupItem value="reply" />
              Toda resposta humana
            </label>
            <label className="flex items-center gap-2 text-xs">
              <RadioGroupItem value="high_readiness" />
              Só quando a IA detectar prontidão ALTA para reunião
            </label>
          </RadioGroup>
        </div>

        <div className="space-y-1.5 border-t border-border pt-3">
          <Label className="text-xs">Intervalo mínimo entre avisos do mesmo lead (minutos)</Label>
          <Input
            type="number"
            min={0}
            value={config.cooldown_minutes}
            onChange={(e) =>
              setConfig({ ...config, cooldown_minutes: Math.max(0, Number(e.target.value) || 0) })
            }
            className="h-8 w-24 text-xs"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Salvando…" : "Salvar notificações"}
        </Button>
      </div>
    </div>
  );
}
