import { FastifyInstance } from "fastify";
import { getWorkerStatusController } from "./workers.controller";

export async function workersRoutes(app: FastifyInstance) {
  app.get("/status", getWorkerStatusController);
}