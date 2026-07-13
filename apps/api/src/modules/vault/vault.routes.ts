import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyMultipart from "@fastify/multipart";
import {
  addApiKeyController,
  createEntryController,
  deleteApiKeyController,
  deleteAttachmentController,
  deleteEntryController,
  downloadAttachmentController,
  getEntryController,
  listEntriesController,
  toggleFavoriteController,
  updateEntryController,
  uploadAttachmentController,
} from "./vault.controller";

/**
 * Exige, além da sessão normal (já validada globalmente em server.ts), um
 * vault_token válido — emitido só depois da verificação TOTP bem-sucedida
 * (POST /vault-auth/verify). Sem isso o cofre em si permanece bloqueado.
 *
 * O token vem no header `X-Vault-Token`, não em `Authorization` — o
 * lookupToken do @fastify/jwt escaneia `Authorization: Bearer` para QUALQUER
 * instância registrada (inclusive a de sessão principal), então se o token do
 * cofre fosse mandado ali, o preHandler global de sessão tentaria validá-lo
 * com o secret errado e derrubaria a request com 401 antes de chegar aqui.
 */
type VaultPayload = { userId: string; scope: string };

function getVaultJwt(app: FastifyInstance): { verify: (token: string) => VaultPayload } {
  return (app as unknown as { jwt: { vault: { verify: (token: string) => VaultPayload } } }).jwt.vault;
}

async function requireVaultScope(request: FastifyRequest, reply: FastifyReply) {
  try {
    const token = request.headers["x-vault-token"];
    if (typeof token !== "string" || !token) throw new Error("token ausente");

    const payload = getVaultJwt(request.server).verify(token);
    const sessionUserId = (request.user as { userId: string }).userId;
    if (payload.scope !== "vault" || payload.userId !== sessionUserId) {
      throw new Error("escopo inválido");
    }
  } catch {
    return reply.status(401).send({ error: "Verificação do cofre necessária." });
  }
}

export async function vaultRoutes(app: FastifyInstance) {
  await app.register(fastifyMultipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  app.addHook("preHandler", requireVaultScope);

  app.get("/entries", listEntriesController);
  app.get("/entries/:id", getEntryController);
  app.post("/entries", createEntryController);
  app.patch("/entries/:id", updateEntryController);
  app.delete("/entries/:id", deleteEntryController);
  app.post("/entries/:id/favorite", toggleFavoriteController);

  app.post("/entries/:id/api-keys", addApiKeyController);
  app.delete("/entries/:id/api-keys/:keyId", deleteApiKeyController);

  app.post("/entries/:id/attachments", uploadAttachmentController);
  app.get("/entries/:id/attachments/:attId", downloadAttachmentController);
  app.delete("/entries/:id/attachments/:attId", deleteAttachmentController);
}
