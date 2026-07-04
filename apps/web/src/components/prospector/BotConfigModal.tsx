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
import { getBotConfig, updateBotConfig, type BotConfig } from "@/lib/prospector";
import { AgendaTab } from "./AgendaTab";
import { FiltersTab } from "./FiltersTab";
import { MessagesTab } from "./MessagesTab";

export function BotConfigModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const configQuery = useQuery({ queryKey: ["bot-config"], queryFn: getBotConfig, enabled: open });

  const [schedule, setSchedule] = useState<BotConfig["schedule"] | null>(null);
  const [filters, setFilters] = useState<{ cities: string[]; segments: string[] } | null>(null);

  useEffect(() => {
    if (configQuery.data) {
      setSchedule(configQuery.data.schedule);
      setFilters(configQuery.data.filters);
    }
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => updateBotConfig({ schedule: schedule!, filters: filters! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-config"] });
      queryClient.invalidateQueries({ queryKey: ["bot-status"] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Configurar bot de disparos
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
              <MessagesTab />
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
