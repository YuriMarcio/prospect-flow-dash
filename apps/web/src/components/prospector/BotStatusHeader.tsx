import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Play, Settings2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stopCampaignSession, type CampaignStatus } from "@/lib/prospector";
import { StartSessionDialog } from "./StartSessionDialog";

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function BotStatusHeader({
  campaignId,
  campaignName,
  status,
  onConfigure,
  onConnect,
}: {
  campaignId: string;
  campaignName: string;
  status: CampaignStatus | undefined;
  onConfigure: () => void;
  onConnect: () => void;
}) {
  const queryClient = useQueryClient();
  const [startDialogOpen, setStartDialogOpen] = useState(false);

  const connected = status?.connected ?? false;
  const isActive = status?.is_active ?? false;

  const stopMutation = useMutation({
    mutationFn: () => stopCampaignSession(campaignId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaign-status", campaignId] }),
  });

  function handlePillClick() {
    if (!connected) return onConnect();
    if (isActive) return stopMutation.mutate();
    setStartDialogOpen(true);
  }

  const endTime = formatTime(status?.sessionEndAt ?? null);

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{campaignName}</h1>
        <p className="text-sm text-muted-foreground">
          Arraste leads entre colunas · bot ativo gerenciando disparos
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handlePillClick}
          disabled={stopMutation.isPending}
          className={
            connected && isActive
              ? "flex items-center gap-1.5 rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-600 transition disabled:opacity-50"
              : connected
                ? "flex items-center gap-1.5 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-600 transition disabled:opacity-50"
                : "flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition disabled:opacity-50"
          }
        >
          <span
            className={
              connected && isActive
                ? "h-2 w-2 rounded-full bg-green-500 animate-pulse"
                : connected
                  ? "h-2 w-2 rounded-full bg-yellow-500"
                  : "h-2 w-2 rounded-full bg-muted-foreground"
            }
          />
          {connected && isActive
            ? endTime
              ? `Bot ativo até ${endTime}`
              : "Bot ativo"
            : connected
              ? "Bot pausado — iniciar"
              : "Desconectado — conectar"}
        </button>

        {status?.activeMessage && (
          <span
            className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground max-w-[220px]"
            title={
              status.activeMessage.bot_message_blocks.find((b) => b.type === "text")?.content ??
              status.activeMessage.title
            }
          >
            <MessageCircle className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground shrink-0">Mensagem ativa:</span>
            <span className="truncate max-w-[180px]">{status.activeMessage.title}</span>
          </span>
        )}

        {connected && !isActive && (
          <Button onClick={() => setStartDialogOpen(true)}>
            <Play className="h-4 w-4" />
            Iniciar bot
          </Button>
        )}

        {connected && isActive && (
          <Button
            variant="outline"
            onClick={() => stopMutation.mutate()}
            disabled={stopMutation.isPending}
          >
            <Square className="h-4 w-4" />
            Pausar bot
          </Button>
        )}

        <Button variant="outline" onClick={onConfigure}>
          <Settings2 className="h-4 w-4" />
          Configurar campanha
        </Button>
      </div>

      <StartSessionDialog campaignId={campaignId} open={startDialogOpen} onOpenChange={setStartDialogOpen} />
    </div>
  );
}
