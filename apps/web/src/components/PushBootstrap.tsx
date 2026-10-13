import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  enablePush,
  fetchPublicKey,
  isPushSupported,
  isStandalone,
  sendTestPush,
  subscribeAndSync,
} from "@/lib/push";

const DISMISSED_KEY = "push-prompt-dismissed";

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDismissed() {
  try {
    window.localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Sem localStorage só perde a lembrança do "agora não".
  }
}

/**
 * Sem tela própria. Com a permissão já dada, mantém a inscrição deste aparelho em dia no servidor
 * (o navegador pode trocar o endpoint, e quem trocou de conta no aparelho precisa reassociá-lo).
 * Com o app instalado e a permissão ainda não decidida, oferece ativar os alertas de tarefas.
 */
export function PushBootstrap() {
  // O layout só monta com a sessão ativa (e remonta a cada login), então "uma vez por montagem" é o ponto certo;
  // o ref também evita a execução dupla do StrictMode em desenvolvimento.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !isPushSupported()) return;
    ran.current = true;

    if (Notification.permission === "granted") {
      subscribeAndSync().catch((error) => console.warn("Falha ao sincronizar notificações", error));
      return;
    }

    // O pedido de permissão tem que sair de um clique, então só convidamos — e só no app instalado.
    if (Notification.permission !== "default" || !isStandalone() || readDismissed()) return;

    // Não convida se o servidor ainda não tem as chaves de push configuradas.
    fetchPublicKey()
      .then(() => {
        toast("Ativar alertas de tarefas?", {
          description: "Avise-me das tarefas do dia, do que vai vencer e da meta de cada sprint.",
          duration: Infinity,
          action: {
            label: "Ativar",
            onClick: () => {
              rememberDismissed();
              enablePush()
                .then(() => {
                  toast.success("Notificações ativadas neste aparelho.");
                  sendTestPush().catch(() => undefined);
                })
                .catch((error) =>
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Não foi possível ativar as notificações.",
                  ),
                );
            },
          },
          cancel: { label: "Agora não", onClick: rememberDismissed },
          onDismiss: rememberDismissed,
        });
      })
      .catch(() => undefined);
  }, []);

  return null;
}
