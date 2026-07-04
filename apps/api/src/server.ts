import "dotenv/config";

import Fastify from "fastify";

// Importando todas as rotas da nossa arquitetura
import { campaignsRoutes } from "./modules/campaigns/campaigns.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { leadsRoutes } from "./modules/leads/leads.routes";
import { logsRoutes } from "./modules/logs/logs.routes";
import { workersRoutes } from "./modules/workers/workers.routes";
import { prospectorRoutes } from "./modules/prospector/prospector.routes";
import { runDispatchTick } from "./workers/prospector/dispatcher.worker";
import { buildTodayQueue } from "./workers/prospector/queue-builder.worker";
import { runSessionTick } from "./workers/prospector/session.worker";

const app = Fastify({
  logger: true,
  // payload em base64 de imagem/áudio do bot de prospecção passa fácil do 1MB padrão
  bodyLimit: 20 * 1024 * 1024,
});

async function bootstrap() {
  try {
    // 1. Registrando CORS
    app.addHook("onRequest", async (request, reply) => {
      reply.header(
        "Access-Control-Allow-Origin",
        request.headers.origin ?? "*",
      );
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

    // 2. Health Check
    app.get("/", async () => {
      return {
        ok: true,
        message: "API LeadFlow is running! 🚀",
      };
    });

    // 3. Registrando os Módulos (Nossos 4 pilares)
    await app.register(dashboardRoutes, { prefix: "/dashboard" });
    await app.register(campaignsRoutes, { prefix: "/campaigns" });
    await app.register(leadsRoutes, { prefix: "/leads" });
    await app.register(logsRoutes, { prefix: "/logs" });
    await app.register(workersRoutes, { prefix: "/workers" });
    await app.register(prospectorRoutes, { prefix: "/prospector" });

    // 4. Iniciando o servidor
    // O host "0.0.0.0" é importante se for rodar em Docker ou cloud depois
    await app.listen({
      port: Number(process.env.PORT ?? 3333),
      host: "0.0.0.0",
    });

    // 5. Bot de prospecção: dispatcher a cada 60s + builder diário às 07:45
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
      buildTodayQueue().catch((err) => app.log.error({ err }, "[PROSPECTOR] Falha ao construir fila diária"));
    }
  }, 60_000);
}

// Executando a inicialização
bootstrap();
