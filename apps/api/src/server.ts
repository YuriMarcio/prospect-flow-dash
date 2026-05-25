import "dotenv/config";

import Fastify from "fastify";

// Importando todas as rotas da nossa arquitetura
import { campaignsRoutes } from "./modules/campaigns/campaigns.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { leadsRoutes } from "./modules/leads/leads.routes";
import { logsRoutes } from "./modules/logs/logs.routes";
import { workersRoutes } from "./modules/workers/workers.routes";

const app = Fastify({
  logger: true,
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

    // 4. Iniciando o servidor
    // O host "0.0.0.0" é importante se for rodar em Docker ou cloud depois
    await app.listen({
      port: Number(process.env.PORT ?? 3333),
      host: "0.0.0.0",
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Executando a inicialização
bootstrap();
