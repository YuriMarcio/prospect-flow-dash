import { useQuery } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCampaign } from "@/lib/prospector";
import { FlowCanvas } from "./flow/FlowCanvas";
import { AgendaLimitsTab } from "./AgendaLimitsTab";
import { AiTab } from "./AiTab";
import { NotificationsTab } from "./NotificationsTab";

/**
 * Board fullscreen (92vw × 90vh) de configuração da campanha: fluxo de
 * mensagens no canvas, agenda & limites, IA & respostas e notificações.
 * Substitui o antigo BotConfigModal de 560px.
 */
export function CampaignBoard({
  campaignId,
  open,
  onOpenChange,
}: {
  campaignId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const campaignQuery = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: () => getCampaign(campaignId),
    enabled: open,
  });
  const campaign = campaignQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] w-[92vw] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-primary" />
            {campaign?.name ?? "Campanha"}
            {campaign && (
              <span
                className={
                  campaign.is_active
                    ? "rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-600"
                    : "rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                }
              >
                {campaign.is_active ? "Ativa" : "Pausada"}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {campaign ? (
          <Tabs defaultValue="fluxo" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-4 mt-3 w-fit shrink-0">
              <TabsTrigger value="fluxo">Fluxo de mensagens</TabsTrigger>
              <TabsTrigger value="agenda">Agenda & limites</TabsTrigger>
              <TabsTrigger value="ia">IA & respostas</TabsTrigger>
              <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
            </TabsList>

            {/* forceMount preserva o estado (edições não salvas do canvas) ao trocar de aba */}
            <TabsContent
              value="fluxo"
              forceMount
              className="mt-3 min-h-0 flex-1 border-t border-border data-[state=inactive]:hidden"
            >
              <FlowCanvas campaignId={campaignId} />
            </TabsContent>

            <TabsContent
              value="agenda"
              forceMount
              className="mt-3 min-h-0 flex-1 overflow-y-auto border-t border-border p-4 data-[state=inactive]:hidden"
            >
              <AgendaLimitsTab campaign={campaign} />
            </TabsContent>

            <TabsContent
              value="ia"
              forceMount
              className="mt-3 min-h-0 flex-1 overflow-y-auto border-t border-border p-4 data-[state=inactive]:hidden"
            >
              <AiTab campaign={campaign} />
            </TabsContent>

            <TabsContent
              value="notificacoes"
              forceMount
              className="mt-3 min-h-0 flex-1 overflow-y-auto border-t border-border p-4 data-[state=inactive]:hidden"
            >
              <NotificationsTab campaign={campaign} />
            </TabsContent>
          </Tabs>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">Carregando campanha…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
