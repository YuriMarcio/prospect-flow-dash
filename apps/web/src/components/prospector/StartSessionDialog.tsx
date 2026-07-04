import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
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
import { startCampaignSession } from "@/lib/prospector";

function defaultTime(offsetMinutes = 0): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function StartSessionDialog({
  campaignId,
  open,
  onOpenChange,
}: {
  campaignId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"until_done" | "custom">("until_done");
  const [startTime, setStartTime] = useState(defaultTime());
  const [endTime, setEndTime] = useState(defaultTime(120));

  const mutation = useMutation({
    mutationFn: () => {
      if (mode === "until_done") return startCampaignSession(campaignId, { mode });

      const now = new Date();
      const toIso = (time: string) => {
        const [h, m] = time.split(":").map(Number);
        const d = new Date(now);
        d.setHours(h, m, 0, 0);
        return d.toISOString();
      };

      return startCampaignSession(campaignId, { mode, startAt: toIso(startTime), endAt: toIso(endTime) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-status", campaignId] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" />
            Iniciar bot
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setMode("until_done")}
            className={
              mode === "until_done"
                ? "w-full text-left rounded-lg border border-primary bg-primary/10 p-3"
                : "w-full text-left rounded-lg border border-border p-3 hover:bg-accent/40"
            }
          >
            <p className="text-sm font-medium">Até terminar a fila de hoje</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Começa agora e pausa sozinho quando não houver mais nada pra enviar hoje.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setMode("custom")}
            className={
              mode === "custom"
                ? "w-full text-left rounded-lg border border-primary bg-primary/10 p-3"
                : "w-full text-left rounded-lg border border-border p-3 hover:bg-accent/40"
            }
          >
            <p className="text-sm font-medium">Horário customizado</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Define um horário de início e fim — pausa sozinho ao bater o horário final.
            </p>
          </button>

          {mode === "custom" && (
            <div className="grid grid-cols-2 gap-2 pl-1">
              <div className="space-y-1">
                <Label className="text-xs">Começa às</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Termina às</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Iniciando…" : "Iniciar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
