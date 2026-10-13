import { FastifyReply, FastifyRequest } from "fastify";
import { getVapidPublicKey, isPushConfigured } from "../../lib/webpush";
import * as pushRepository from "./push.repository";
import { sendToUser, TEST_PAYLOAD } from "./push.service";

function userId(request: FastifyRequest): string {
  return (request.user as { userId: string }).userId;
}

const NOT_CONFIGURED = "Notificações push não configuradas no servidor (faltam as chaves VAPID).";

/** O servidor vai fazer um POST nesse endpoint, então só aceitamos https público (nada de localhost/IP interno). */
function isAcceptableEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname;
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
    // IPv4 ou IPv6 literal — serviços de push reais sempre usam nome de domínio.
    if (/^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) return false;
    return true;
  } catch {
    return false;
  }
}

export async function publicKeyController(_request: FastifyRequest, reply: FastifyReply) {
  const publicKey = getVapidPublicKey();
  if (!publicKey) return reply.status(503).send({ error: NOT_CONFIGURED });
  return reply.send({ publicKey });
}

export async function subscribeController(
  request: FastifyRequest<{
    Body: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; userAgent?: unknown };
  }>,
  reply: FastifyReply,
) {
  if (!isPushConfigured()) return reply.status(503).send({ error: NOT_CONFIGURED });

  const { endpoint, keys, userAgent } = request.body ?? {};
  const p256dh = keys?.p256dh;
  const auth = keys?.auth;
  if (!isAcceptableEndpoint(endpoint) || typeof p256dh !== "string" || typeof auth !== "string" || !p256dh || !auth) {
    return reply.status(400).send({ error: "Inscrição de notificação inválida." });
  }

  await pushRepository.upsertSubscription({
    userId: userId(request),
    endpoint,
    p256dh,
    auth,
    userAgent: typeof userAgent === "string" ? userAgent.slice(0, 300) : null,
  });
  return reply.status(204).send();
}

export async function unsubscribeController(
  request: FastifyRequest<{ Body: { endpoint?: unknown } }>,
  reply: FastifyReply,
) {
  const endpoint = request.body?.endpoint;
  if (typeof endpoint !== "string" || !endpoint) {
    return reply.status(400).send({ error: "Informe o endpoint da inscrição." });
  }
  // Filtra pelo usuário: ninguém remove o dispositivo de outra pessoa.
  await pushRepository.removeByEndpoint(endpoint, userId(request));
  return reply.status(204).send();
}

export async function testController(request: FastifyRequest, reply: FastifyReply) {
  if (!isPushConfigured()) return reply.status(503).send({ error: NOT_CONFIGURED });

  const summary = await sendToUser(userId(request), TEST_PAYLOAD);
  if (summary.total === 0) {
    return reply.status(404).send({ error: "Nenhum dispositivo seu está inscrito nas notificações." });
  }
  if (summary.delivered === 0) {
    return reply.status(502).send({ error: "O serviço de push não aceitou a notificação. Tente de novo em instantes." });
  }
  return reply.send({ delivered: summary.delivered, total: summary.total });
}
