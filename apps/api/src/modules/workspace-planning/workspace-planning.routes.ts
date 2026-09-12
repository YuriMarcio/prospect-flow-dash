import { FastifyInstance } from "fastify";
import fastifyMultipart from "@fastify/multipart";
import {
  appendTurnController,
  cancelSessionController,
  confirmSessionController,
  getActiveSessionController,
} from "./workspace-planning.controller";

export async function workspacePlanningRoutes(app: FastifyInstance) {
  await app.register(fastifyMultipart, {
    limits: { fileSize: 15 * 1024 * 1024 },
  });

  app.get("/session", getActiveSessionController);
  app.post("/session/:id/turns", appendTurnController);
  app.post("/session/:id/confirm", confirmSessionController);
  app.post("/session/:id/cancel", cancelSessionController);
}
