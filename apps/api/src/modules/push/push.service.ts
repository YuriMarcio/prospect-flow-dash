import { sendPush, type PushPayload } from "../../lib/webpush";
import * as pushRepository from "./push.repository";

export interface PushSendSummary {
  /** Dispositivos inscritos do usuário. */
  total: number;
  /** Dispositivos que aceitaram a entrega. */
  delivered: number;
  /** Houve erro passageiro (rede, serviço de push fora): vale tentar de novo depois. */
  retryable: boolean;
}

/** Envia para todos os dispositivos do usuário e apaga as inscrições que o navegador já invalidou. */
export async function sendToUser(userId: string, payload: PushPayload): Promise<PushSendSummary> {
  const subscriptions = await pushRepository.listByUser(userId);
  const results = await Promise.all(
    subscriptions.map(async (subscription) => ({ subscription, result: await sendPush(subscription, payload) })),
  );

  const gone = results.filter((entry) => entry.result === "gone");
  await Promise.all(gone.map((entry) => pushRepository.removeByEndpoint(entry.subscription.endpoint)));

  const delivered = results.filter((entry) => entry.result === "sent");
  await pushRepository.touchSubscriptions(delivered.map((entry) => entry.subscription.id));

  return {
    total: subscriptions.length,
    delivered: delivered.length,
    retryable: results.some((entry) => entry.result === "failed"),
  };
}

export const TEST_PAYLOAD: PushPayload = {
  title: "Zapediu · Notificações ativadas",
  body: "Pronto! Você vai receber lembretes das tarefas que vencem e das metas do dia.",
  tag: "test",
  url: "/objetivos",
};
