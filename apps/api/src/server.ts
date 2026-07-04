import "dotenv/config";

import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";

// Importando todas as rotas da nossa arquitetura
import { authRoutes } from "./modules/auth/auth.routes";
import { SESSION_COOKIE_NAME } from "./modules/auth/auth.constants";
import { campaignsRoutes } from "./modules/campaigns/campaigns.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { leadsRoutes } from "./modules/leads/leads.routes";
import { logsRoutes } from "./modules/logs/logs.routes";
import { workersRoutes } from "./modules/workers/workers.routes";
import { prospectorRoutes } from "./modules/prospector/prospector.routes";
import { runDispatchTick } from "./workers/prospector/dispatcher.worker";
import { buildTodayQueueForAllOwners } from "./workers/prospector/queue-builder.worker";
import { runSessionTick } from "./workers/prospector/session.worker";

const app = Fastify({
  logger: true,
  // payload em base64 de imagem/áudio do bot de prospecção passa fácil do 1MB padrão
  bodyLimit: 20 * 1024 * 1024,
});

// Rotas acessíveis sem sessão: health check, login, e o webhook que a
// própria Evolution API chama de fora (não tem como mandar nosso cookie).
const PUBLIC_PATHS = new Set(["/", "/auth/login", "/auth/google"]);
const PUBLIC_PATH_PREFIXES = ["/prospector/webhook/"];

function isPublicPath(url: string): boolean {
  const path = url.split("?")[0];
  return PUBLIC_PATHS.has(path) || PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

async function bootstrap() {
  try {
    const allowedOrigins = (process.env.WEB_ORIGIN ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);

    // Previews da Vercel geram um domínio novo a cada PR (ex: leadflow-git-foo.vercel.app),
    // então além da allow-list fixa aceitamos qualquer subdomínio *.vercel.app.
    const isVercelOrigin = (origin: string) => /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin);

    // 1. Registrando CORS (allow-list, com suporte a cookies)
    app.addHook("onRequest", async (request, reply) => {
      const origin = request.headers.origin;
      if (origin && (allowedOrigins.includes(origin) || isVercelOrigin(origin))) {
        reply.header("Access-Control-Allow-Origin", origin);
        reply.header("Access-Control-Allow-Credentials", "true");
      }
      reply.header(
        "Access-Control-Allow-Methods",
        "GET,POST,PATCH,PUT,DELETE,OPTIONS",
      );
      reply.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
    });

    app.options("*", async (_request, reply) => reply.status(204).send());

    if (!process.env.SESSION_SECRET) {
      throw new Error("Configure SESSION_SECRET no .env para habilitar o login.");
    }

    await app.register(fastifyCookie);
    await app.register(fastifyJwt, {
      secret: process.env.SESSION_SECRET,
      cookie: { cookieName: SESSION_COOKIE_NAME, signed: false },
    });

    // 2. Gate de autenticação global — exige sessão válida em toda rota,
    // exceto as públicas listadas acima.
    app.addHook("preHandler", async (request, reply) => {
      if (request.method === "OPTIONS" || isPublicPath(request.url)) return;

      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "Não autenticado." });
      }
    });

    // 3. Health Check
    app.get("/", async () => {
      return {
        ok: true,
        message: "API LeadFlow is running! 🚀",
      };
    });

    // 4. Registrando os Módulos (Nossos 4 pilares)
    await app.register(authRoutes, { prefix: "/auth" });
    await app.register(dashboardRoutes, { prefix: "/dashboard" });
    await app.register(campaignsRoutes, { prefix: "/campaigns" });
    await app.register(leadsRoutes, { prefix: "/leads" });
    await app.register(logsRoutes, { prefix: "/logs" });
    await app.register(workersRoutes, { prefix: "/workers" });
    await app.register(prospectorRoutes, { prefix: "/prospector" });

    // 5. Iniciando o servidor
    // O host "0.0.0.0" é importante se for rodar em Docker ou cloud depois
    await app.listen({
      port: Number(process.env.PORT ?? 3333),
      host: "0.0.0.0",
    });

    // 6. Bot de prospecção: dispatcher a cada 60s + builder diário às 07:45
    setupProspectorScheduler();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

function setupProspectorScheduler() {
  let lastBuildDate: string | null = null;

  setInterval(() => {
    runSessionTick().catch((err) => app.log.error({ err }, "[PROSPECTOR] Falha no session tick"));
    runDispatchTick().catch((err) => app.log.error({ err }, "[PROSPECTOR] Falha no dispatcher tick"));
  }, 60_000);

  setInterval(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const isBuildTime = now.getHours() === 7 && now.getMinutes() === 45;

    if (isBuildTime && lastBuildDate !== today) {
      lastBuildDate = today;
      buildTodayQueueForAllOwners().catch((err) => app.log.error({ err }, "[PROSPECTOR] Falha ao construir fila diária"));
    }
  }, 60_000);
}

// Executando a inicialização
bootstrap();
