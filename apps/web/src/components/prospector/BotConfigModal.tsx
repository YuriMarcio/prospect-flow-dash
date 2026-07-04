import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { getCampaign, updateCampaign, type Schedule } from "@/lib/prospector";
import { AgendaTab } from "./AgendaTab";
import { FiltersTab } from "./FiltersTab";
import { MessagesTab } from "./MessagesTab";

export function BotConfigModal({
  campaignId,
  open,
  onOpenChange,
}: {
  campaignId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const campaignQuery = useQuery({
    queryKey: ["campaign", campaignId],
    queryFn: () => getCampaign(campaignId),
    enabled: open,
  });

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [filters, setFilters] = useState<{ cities: string[]; segments: string[] } | null>(null);

  useEffect(() => {
    if (campaignQuery.data) {
      setSchedule(campaignQuery.data.schedule);
      setFilters(campaignQuery.data.filters);
    }
  }, [campaignQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => updateCampaign(campaignId, { schedule: schedule!, filters: filters! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaign-status", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Configurar {campaignQuery.data?.name ?? "campanha"}
          </DialogTitle>
        </DialogHeader>

        {schedule && filters ? (
          <Tabs defaultValue="agenda">
            <TabsList>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
              <TabsTrigger value="filtros">Filtros</TabsTrigger>
              <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
            </TabsList>

            <TabsContent value="agenda">
              <AgendaTab schedule={schedule} onChange={setSchedule} />
            </TabsContent>

            <TabsContent value="filtros">
              <FiltersTab filters={filters} onChange={setFilters} />
            </TabsContent>

            <TabsContent value="mensagens">
              <MessagesTab campaignId={campaignId} />
            </TabsContent>
          </Tabs>
        ) : (
          <p className="text-sm text-muted-foreground py-6 text-center">Carregando configuração…</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!schedule || !filters || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Salvando…" : "Salvar configuração"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
