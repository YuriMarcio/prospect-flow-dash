import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Clock,
  Layers,
  LayoutGrid,
  List,
  Play,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getDashboard, listCampaigns } from "@/lib/api";
import type { Capture } from "@/types";
import { AutomationStatCard } from "@/components/automacao/AutomationStatCard";
import { AutomationOptionCard } from "@/components/automacao/AutomationOptionCard";
import { AutomationOptionRow } from "@/components/automacao/AutomationOptionRow";
import { AUTOMATION_OPTIONS, type AutomationFlowId } from "@/components/automacao/automationOptions";
import { InstagramFormDialog } from "@/components/automacao/InstagramFormDialog";
import { IfoodFormDialog } from "@/components/automacao/IfoodFormDialog";
import { InstaDeliveryFormDialog } from "@/components/automacao/InstaDeliveryFormDialog";
import { RunningCampaignPanel } from "@/components/automacao/RunningCampaignPanel";
import { LogsFeedPanel } from "@/components/automacao/LogsFeedPanel";
import { estimateRemainingMinutes } from "@/components/automacao/estimate";

export function AutomacaoPage() {
  const [openFlow, setOpenFlow] = useState<AutomationFlowId | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");

  const campaignsQuery = useQuery({
    queryKey: ["campaigns"],
    queryFn: listCampaigns,
    refetchInterval: (q) => {
      const data = q.state.data as Capture[] | undefined;
      return data?.some((c) => c.status === "running") ? 3000 : false;
    },
  });

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
  });

  const campaigns = campaignsQuery.data ?? [];
  const activeCampaign = campaigns.find((c) => c.status === "running")
    ?? (campaigns[0]?.status === "done" || campaigns[0]?.status === "error" ? campaigns[0] : undefined);
  const anyRunning = campaigns.some((c) => c.status === "running");

  const executionsActive = campaigns.filter((c) => c.status === "running").length;
  const leadsCapturados = dashboardQuery.data?.metrics.leadsCapturados ?? 0;
  const remainingMin = activeCampaign ? estimateRemainingMinutes(activeCampaign) : null;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <InstagramFormDialog
        open={openFlow === "instagram"}
        onOpenChange={(v) => setOpenFlow(v ? "instagram" : null)}
        anyRunning={anyRunning}
      />
      <IfoodFormDialog
        open={openFlow === "ifood"}
        onOpenChange={(v) => setOpenFlow(v ? "ifood" : null)}
        anyRunning={anyRunning}
      />
      <InstaDeliveryFormDialog
        open={openFlow === "instadelivery"}
        onOpenChange={(v) => setOpenFlow(v ? "instadelivery" : null)}
        anyRunning={anyRunning}
      />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Automações de Captação</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Escolha um fluxo de captura e configure os parâmetros para iniciar.
          </p>
        </div>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="outline" disabled>
                  <BookOpen className="h-4 w-4" />
                  Documentação
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Em breve</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AutomationStatCard
          label="Automações disponíveis"
          value={AUTOMATION_OPTIONS.length}
          subtitle="Fluxos ativos"
          icon={Layers}
          accent="primary"
        />
        <AutomationStatCard
          label="Execuções ativas"
          value={executionsActive}
          subtitle="Em andamento"
          icon={Play}
          accent="success"
        />
        <AutomationStatCard
          label="Leads capturados"
          value={leadsCapturados.toLocaleString("pt-BR")}
          subtitle="Total capturados"
          icon={Users}
          accent="info"
        />
        <AutomationStatCard
          label="Tempo estimado restante"
          value={remainingMin !== null ? `${remainingMin} min` : "—"}
          subtitle="Na execução atual"
          icon={Clock}
          accent="warning"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Escolha uma automação</h2>
            <p className="text-sm text-muted-foreground">
              Selecione o fluxo ideal para o seu objetivo de prospecção.
            </p>
          </div>
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && setViewMode(v as "cards" | "list")}
            variant="outline"
          >
            <ToggleGroupItem value="cards" aria-label="Ver em cards">
              <LayoutGrid className="h-4 w-4" />
              Cards
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Ver em lista">
              <List className="h-4 w-4" />
              Lista
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {viewMode === "cards" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {AUTOMATION_OPTIONS.map((option) => (
              <AutomationOptionCard key={option.id} option={option} onConfigure={() => setOpenFlow(option.id)} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {AUTOMATION_OPTIONS.map((option) => (
              <AutomationOptionRow key={option.id} option={option} onConfigure={() => setOpenFlow(option.id)} />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {activeCampaign ? (
          <RunningCampaignPanel campaign={activeCampaign} />
        ) : (
          <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-center text-sm text-muted-foreground min-h-40">
            Nenhuma execução recente.
          </div>
        )}
        <LogsFeedPanel campaign={activeCampaign} />
      </div>
    </div>
  );
}
