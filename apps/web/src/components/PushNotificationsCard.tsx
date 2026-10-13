import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  disablePush,
  enablePush,
  isIos,
  isPushSupported,
  isStandalone,
  isSubscribedHere,
  sendTestPush,
} from "@/lib/push";

type Support = "checking" | "ok" | "ios-install" | "unsupported";

const SCHEDULE = [
  "Manhã (8h): tarefas que vencem hoje e as que já estão atrasadas",
  "Manhã (8h): sprint terminando em até 2 dias com trabalho pendente",
  "Tarde (16h): tarefas que vencem amanhã",
  "Fim do dia (18h): o que ainda falta para fechar a meta do dia",
];

export function PushNotificationsCard() {
  const [support, setSupport] = useState<Support>("checking");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) {
      // No iPhone o push só existe dentro do app instalado; no Safari comum a API nem aparece.
      setSupport(isIos() && !isStandalone() ? "ios-install" : "unsupported");
      return;
    }
    setSupport("ok");
    setPermission(Notification.permission);
    isSubscribedHere()
      .then(setEnabled)
      .catch(() => setEnabled(false));
  }, []);

  async function handleToggle(next: boolean) {
    setBusy(true);
    try {
      if (next) {
        await enablePush();
        setEnabled(true);
        toast.success("Notificações ativadas neste aparelho.");
        // Uma notificação de verdade na hora confirma que está tudo funcionando.
        sendTestPush().catch(() => undefined);
      } else {
        await disablePush();
        setEnabled(false);
        toast.success("Notificações desativadas neste aparelho.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível alterar as notificações.",
      );
    } finally {
      setPermission(Notification.permission);
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    try {
      await sendTestPush();
      toast.success("Notificação de teste enviada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o teste.");
    } finally {
      setBusy(false);
    }
  }

  const blocked = permission === "denied" && !enabled;

  return (
    <section className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <BellRing className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div>
            <h2 className="text-sm font-semibold">Alertas de tarefas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Avisos no celular ou no computador, mesmo com o app fechado. Vale só para este
              aparelho.
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={busy || support !== "ok" || blocked}
          aria-label="Receber alertas de tarefas neste aparelho"
        />
      </div>

      {support === "ios-install" && (
        <p className="text-xs text-muted-foreground">
          No iPhone e no iPad as notificações só funcionam no app instalado: toque em Compartilhar,
          escolha “Adicionar à Tela de Início”, abra o Zapediu pelo ícone e ative aqui.
        </p>
      )}
      {support === "unsupported" && (
        <p className="text-xs text-muted-foreground">
          Este navegador não suporta notificações push.
        </p>
      )}
      {blocked && (
        <p className="text-xs text-destructive">
          As notificações estão bloqueadas neste navegador. Libere nas configurações do site para
          poder ativar.
        </p>
      )}

      <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-5">
        {SCHEDULE.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        Você recebe as tarefas em que é responsável e as que estão sem responsável.
      </p>

      {enabled && (
        <Button variant="outline" size="sm" onClick={handleTest} disabled={busy}>
          Enviar notificação de teste
        </Button>
      )}
    </section>
  );
}
