import { useQuery } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCampaign } from "@/lib/prospector";
import { FlowCanvas } from "./flow/FlowCanvas";
import { ExecutionTab } from "./ExecutionTab";
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
  initialTab,
}: {
  campaignId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTab?: string;
}) {
  const campaignQuery = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: () => getCampaign(campaignId),
    enabled: open,
  });
  const campaign = campaignQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Celular: tela cheia (sem as margens do "92vw × 90vh"); a partir de md segue o board de sempre */}
      <DialogContent className="flex h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden p-0 max-md:rounded-none max-md:border-0 md:h-[90vh] md:w-[92vw]">
        <DialogHeader className="border-b border-border px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pr-12 md:pt-3">
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
          <Tabs defaultValue={initialTab ?? "fluxo"} className="flex min-h-0 flex-1 flex-col">
            {/* As quatro abas não cabem em 390px: a faixa rola pro lado em vez de cortar */}
            <TabsList className="no-scrollbar mx-4 mt-3 w-fit max-w-[calc(100%-2rem)] shrink-0 justify-start overflow-x-auto">
              <TabsTrigger value="fluxo">Fluxo de mensagens</TabsTrigger>
              <TabsTrigger value="execucao">Execução & agenda</TabsTrigger>
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
              value="execucao"
              forceMount
              className="mt-3 min-h-0 flex-1 overflow-y-auto border-t border-border p-4 data-[state=inactive]:hidden"
            >
              <ExecutionTab campaign={campaign} />
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
