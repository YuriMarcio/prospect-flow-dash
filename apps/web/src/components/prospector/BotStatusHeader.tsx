import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Play, Settings2, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteCampaign, stopCampaignSession, type CampaignStatus } from "@/lib/prospector";

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function BotStatusHeader({
  campaignId,
  campaignName,
  region,
  status,
  onConfigure,
  onConnect,
  onDeleted,
}: {
  campaignId: string;
  campaignName: string;
  /** Território da campanha (ex.: "Ilha do Governador"), mostrado embaixo do nome. */
  region?: string | null;
  status: CampaignStatus | undefined;
  onConfigure: (tab?: string) => void;
  onConnect: () => void;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();

  const connected = status?.connected ?? false;
  const isActive = status?.is_active ?? false;

  const stopMutation = useMutation({
    mutationFn: () => stopCampaignSession(campaignId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["campaign-status", campaignId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCampaign(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospecting-campaigns"] });
      toast.success(
        `Campanha "${campaignName}" excluída. Os leads voltaram para o Kanban geral.`,
      );
      onDeleted();
    },
    onError: () => toast.error("Não foi possível excluir a campanha."),
  });

  function handlePillClick() {
    if (!connected) return onConnect();
    if (isActive) return stopMutation.mutate();
    // Iniciar acontece dentro do board, na aba de execução (com previsão e avisos)
    onConfigure("execucao");
  }

  const endTime = formatTime(status?.sessionEndAt ?? null);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-tight md:text-2xl">{campaignName}</h1>
        <p className="truncate text-xs text-muted-foreground md:text-sm">
          {region}
          {/* A frase de apoio só no desktop; no celular fica só o território */}
          <span className="hidden md:inline">
            {region ? " · " : ""}você escolhe quais leads o bot contata
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handlePillClick}
          disabled={stopMutation.isPending}
          className={
            connected && isActive
              ? "flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-green-500/40 bg-green-500/10 px-3 text-xs font-medium text-green-600 transition disabled:opacity-50 md:h-auto md:py-1.5"
              : connected
                ? "flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 text-xs font-medium text-yellow-600 transition disabled:opacity-50 md:h-auto md:py-1.5"
                : "flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted px-3 text-xs font-medium text-muted-foreground transition disabled:opacity-50 md:h-auto md:py-1.5"
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
          {connected && isActive ? (
            <>
              <span className="md:hidden">{endTime ? `Ativo até ${endTime}` : "Ativo"}</span>
              <span className="hidden md:inline">{endTime ? `Bot ativo até ${endTime}` : "Bot ativo"}</span>
            </>
          ) : connected ? (
            <>
              <span className="md:hidden">Pausado</span>
              <span className="hidden md:inline">Bot pausado — iniciar</span>
            </>
          ) : (
            <>
              <span className="md:hidden">Conectar WhatsApp</span>
              <span className="hidden md:inline">Desconectado — conectar</span>
            </>
          )}
        </button>

        {status?.activeMessage && (
          <span
            className="hidden max-w-[220px] items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground md:flex"
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
          <Button className="max-md:h-10 max-md:flex-1" onClick={() => onConfigure("execucao")}>
            <Play className="h-4 w-4" />
            Iniciar bot
          </Button>
        )}

        {connected && isActive && (
          <Button
            variant="outline"
            className="max-md:h-10 max-md:flex-1"
            onClick={() => stopMutation.mutate()}
            disabled={stopMutation.isPending}
          >
            <Square className="h-4 w-4" />
            Pausar bot
          </Button>
        )}

        <Button
          variant="outline"
          className="max-md:h-10 max-md:w-10 max-md:shrink-0 max-md:px-0 max-md:ml-auto"
          onClick={() => onConfigure()}
          aria-label="Configurar campanha"
        >
          <Settings2 className="h-4 w-4" />
          <span className="max-md:hidden">Configurar campanha</span>
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 text-destructive hover:text-destructive max-md:h-10 max-md:w-10"
              aria-label="Excluir campanha"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir "{campaignName}"?</AlertDialogTitle>
              <AlertDialogDescription>
                A fila, o plano da semana e as mensagens dessa campanha são apagados. Os leads que
                estavam nela voltam para o Kanban geral, disponíveis para outra campanha. Essa ação
                não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate()}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
