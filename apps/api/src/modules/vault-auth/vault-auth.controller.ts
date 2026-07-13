import { FastifyReply, FastifyRequest } from "fastify";
import {
  confirmTotpEnrollService,
  getTotpStatusService,
  lockVaultService,
  startTotpEnrollService,
  VaultLockedError,
  verifyTotpService,
} from "./vault-auth.service";
import { VAULT_TOKEN_TTL_SECONDS } from "./vault-auth.constants";

function userId(request: FastifyRequest): string {
  return (request.user as { userId: string }).userId;
}

function clientMeta(request: FastifyRequest) {
  const userAgent = request.headers["user-agent"];
  return {
    ipAddress: request.ip,
    userAgent: typeof userAgent === "string" ? userAgent : null,
  };
}

export async function statusController(request: FastifyRequest, reply: FastifyReply) {
  const result = await getTotpStatusService(userId(request));
  return reply.send(result);
}

export async function enrollStartController(request: FastifyRequest, reply: FastifyReply) {
  const result = await startTotpEnrollService(userId(request));
  return reply.send(result);
}

export async function enrollConfirmController(
  request: FastifyRequest<{ Body: { code?: string } }>,
  reply: FastifyReply,
) {
  const code = request.body?.code;
  if (!code) return reply.status(400).send({ error: "Informe o código." });

  try {
    const result = await confirmTotpEnrollService(userId(request), code);
    return reply.send(result);
  } catch (err) {
    return reply.status(400).send({ error: err instanceof Error ? err.message : "Código inválido." });
  }
}

export async function verifyController(
  request: FastifyRequest<{ Body: { code?: string } }>,
  reply: FastifyReply,
) {
  const code = request.body?.code;
  if (!code) return reply.status(400).send({ error: "Informe o código." });

  try {
    await verifyTotpService(userId(request), code, clientMeta(request));
  } catch (err) {
    if (err instanceof VaultLockedError) {
      return reply.status(429).send({ error: err.message, retryAfterSeconds: err.retryAfterSeconds });
    }
    return reply.status(401).send({ error: err instanceof Error ? err.message : "Código incorreto." });
  }

  const uid = userId(request);
  const vaultToken = await reply.vaultJwtSign({ userId: uid, scope: "vault" }, { expiresIn: `${VAULT_TOKEN_TTL_SECONDS}s` });
  const expiresAt = Date.now() + VAULT_TOKEN_TTL_SECONDS * 1000;

  return reply.send({ vaultToken, expiresAt });
}

export async function lockController(request: FastifyRequest, reply: FastifyReply) {
  await lockVaultService(userId(request), clientMeta(request));
  return reply.status(204).send();
}
