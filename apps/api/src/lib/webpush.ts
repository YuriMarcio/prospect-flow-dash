import "dotenv/config";

import webpush from "web-push";

export interface PushPayload {
  title: string;
  body: string;
  /** Notificações com a mesma tag substituem a anterior em vez de empilhar. */
  tag?: string;
  /** Rota do app aberta ao tocar na notificação. */
  url?: string;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** sent = entregue ao serviço de push · gone = inscrição expirada (apagar) · failed = erro passageiro. */
export type PushSendResult = "sent" | "gone" | "failed";

// O subject do VAPID precisa ser mailto: ou https:. Sem VAPID_SUBJECT usamos a origem do web app.
function resolveSubject(): string | null {
  const explicit = process.env.VAPID_SUBJECT?.trim();
  if (explicit) return explicit;
  const origin = (process.env.WEB_ORIGIN ?? "")
    .split(",")
    .map((value) => value.trim())
    .find((value) => value.startsWith("https://"));
  return origin ?? null;
}

let configured: boolean | null = null;

export function isPushConfigured(): boolean {
  if (configured !== null) return configured;

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = resolveSubject();

  if (!publicKey || !privateKey || !subject) {
    configured = false;
    return configured;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return configured;
}

export function getVapidPublicKey(): string | null {
  return isPushConfigured() ? (process.env.VAPID_PUBLIC_KEY?.trim() ?? null) : null;
}

export async function sendPush(target: PushTarget, payload: PushPayload): Promise<PushSendResult> {
  if (!isPushConfigured()) return "failed";

  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      // Lembrete de tarefa perde o sentido depois de algumas horas: o serviço de push descarta a entrega.
      { TTL: 60 * 60 * 6, urgency: "normal" },
    );
    return "sent";
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) return "gone";
    console.warn(`[PUSH] Falha ao enviar (status ${statusCode ?? "?"}):`, error instanceof Error ? error.message : error);
    return "failed";
  }
}
