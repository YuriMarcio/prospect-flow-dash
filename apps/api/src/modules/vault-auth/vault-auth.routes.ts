import { FastifyInstance } from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";
import {
  enrollConfirmController,
  enrollStartController,
  lockController,
  statusController,
  verifyController,
} from "./vault-auth.controller";

export async function vaultAuthRoutes(app: FastifyInstance) {
  // Freio de DoS barato por cima do bloqueio real (que vem do audit log em vault-auth.service.ts).
  await app.register(fastifyRateLimit, {
    max: 10,
    timeWindow: "1 minute",
  });

  app.get("/status", statusController);
  app.post("/totp/enroll/start", enrollStartController);
  app.post("/totp/enroll/confirm", enrollConfirmController);
  app.post("/verify", verifyController);
  app.post("/lock", lockController);
}
