import { FastifyInstance } from "fastify";
import { getDashboardController } from "./dashboard.controller";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/", getDashboardController);
}
