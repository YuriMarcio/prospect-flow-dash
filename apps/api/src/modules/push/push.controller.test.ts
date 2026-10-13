import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import webpush from "web-push";

// O estado do VAPID é lido na primeira chamada, então as chaves entram no ambiente antes de carregar as rotas.
const vapid = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
process.env.VAPID_PRIVATE_KEY = vapid.privateKey;
process.env.VAPID_SUBJECT = "mailto:teste@example.com";

let app: FastifyInstance;

before(async () => {
  const { pushRoutes } = await import("./push.routes");
  app = Fastify();
  app.addHook("preHandler", async (request) => {
    (request as unknown as { user: { userId: string } }).user = { userId: "user-1" };
  });
  await app.register(pushRoutes, { prefix: "/push" });
});

after(async () => {
  await app.close();
});

const validKeys = { p256dh: "BPublicKey", auth: "authSecret" };

async function subscribe(body: unknown) {
  return app.inject({ method: "POST", url: "/push/subscribe", payload: body as object });
}

describe("GET /push/public-key", () => {
  it("devolve a chave pública VAPID para o navegador se inscrever", async () => {
    const response = await app.inject({ method: "GET", url: "/push/public-key" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { publicKey: vapid.publicKey });
  });
});

describe("POST /push/subscribe — validação do endpoint", () => {
  // O servidor faz POST nesse endereço ao enviar; endpoint interno viraria SSRF.
  const rejected = [
    ["http sem TLS", "http://fcm.googleapis.com/fcm/send/abc"],
    ["localhost", "https://localhost/x"],
    ["IPv4 literal", "https://127.0.0.1/x"],
    ["rede interna", "https://10.0.0.5/x"],
    ["IPv6 literal", "https://[::1]/x"],
    ["domínio .internal", "https://metadata.google.internal/x"],
    ["domínio .local", "https://impressora.local/x"],
    ["não é URL", "isso nao e url"],
    ["tamanho absurdo", `https://fcm.googleapis.com/${"a".repeat(3000)}`],
  ] as const;

  for (const [label, endpoint] of rejected) {
    it(`recusa ${label}`, async () => {
      const response = await subscribe({ endpoint, keys: validKeys });
      assert.equal(response.statusCode, 400);
    });
  }

  it("recusa endpoint que não é texto", async () => {
    assert.equal((await subscribe({ endpoint: 42, keys: validKeys })).statusCode, 400);
    assert.equal((await subscribe({ keys: validKeys })).statusCode, 400);
  });

  it("recusa inscrição sem as chaves de criptografia", async () => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/abc";
    assert.equal((await subscribe({ endpoint })).statusCode, 400);
    assert.equal((await subscribe({ endpoint, keys: { p256dh: "x" } })).statusCode, 400);
    assert.equal((await subscribe({ endpoint, keys: { p256dh: "", auth: "y" } })).statusCode, 400);
  });
});

describe("POST /push/unsubscribe", () => {
  it("exige o endpoint", async () => {
    const response = await app.inject({ method: "POST", url: "/push/unsubscribe", payload: {} });
    assert.equal(response.statusCode, 400);
  });
});
