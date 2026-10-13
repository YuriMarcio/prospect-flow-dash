import { request } from "@/lib/api";

/** Notificações push exigem service worker + PushManager + Notification (no iPhone só dentro do PWA instalado). */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Rodando como app instalado (PWA), não numa aba do navegador. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+ se apresenta como Mac; o toque identifica.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function urlBase64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(current: ArrayBuffer | null, expected: Uint8Array): boolean {
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === expected.length && bytes.every((byte, index) => byte === expected[index]);
}

// `serviceWorker.ready` nunca resolve se o registro falhou (ex.: http fora de localhost) — limita a espera.
async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
  ]);
  if (!registration)
    throw new Error(
      "O app ainda não está pronto para notificações. Recarregue a página e tente de novo.",
    );
  return registration;
}

/** Chave pública VAPID do servidor; falha com a mensagem do backend quando o push não está configurado lá. */
export async function fetchPublicKey(): Promise<string> {
  const { publicKey } = await request<{ publicKey: string }>("/push/public-key");
  return publicKey;
}

export async function isSubscribedHere(): Promise<boolean> {
  if (!isPushSupported() || Notification.permission !== "granted") return false;
  const registration = await getRegistration();
  return (await registration.pushManager.getSubscription()) !== null;
}

/** Garante a inscrição deste aparelho (cria se faltar) e registra no servidor. Não pede permissão. */
export async function subscribeAndSync(): Promise<void> {
  const publicKey = await fetchPublicKey();
  const applicationServerKey = urlBase64ToBytes(publicKey);
  const registration = await getRegistration();

  let subscription = await registration.pushManager.getSubscription();
  // Chaves VAPID trocadas no servidor: a inscrição antiga nunca mais entregaria — refaz.
  if (subscription && !sameKey(subscription.options.applicationServerKey, applicationServerKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  const { endpoint, keys } = subscription.toJSON();
  await request("/push/subscribe", {
    method: "POST",
    body: JSON.stringify({ endpoint, keys, userAgent: navigator.userAgent }),
  });
}

/** Pede a permissão (precisa vir de um clique) e inscreve o aparelho. */
export async function enablePush(): Promise<void> {
  // A permissão vem primeiro, no mesmo tick do clique — os navegadores só abrem o pedido com gesto do usuário.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "As notificações estão bloqueadas neste navegador. Libere nas configurações do site e tente de novo."
        : "Permissão de notificação não concedida.",
    );
  }
  await subscribeAndSync();
}

/** Desliga as notificações neste aparelho (outros aparelhos do usuário continuam recebendo). */
export async function disablePush(): Promise<void> {
  const registration = await getRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await request("/push/unsubscribe", {
    method: "POST",
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  await subscription.unsubscribe();
}

/**
 * Ao sair da conta, solta este aparelho no servidor — quem entrar depois nele não recebe as tarefas
 * de outra pessoa. A inscrição do navegador fica; o próximo login a registra de novo.
 */
export async function detachDevice(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const registration = await getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await request("/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } catch {
    // Sair da conta não pode depender disso.
  }
}

export async function sendTestPush(): Promise<void> {
  await request("/push/test", { method: "POST" });
}
