import { FastifyInstance } from "fastify";
import {
  listLeadsController,
  getLeadController,
  updateLeadController,
  deduplicateLeadsController,
  listCitiesController,
  createLeadController,
} from "./leads.controller";

export async function leadsRoutes(app: FastifyInstance) {
  app.get("/", listLeadsController);
  app.post("/", createLeadController);
  app.get("/cities", listCitiesController);
  app.get("/:id", getLeadController);
  app.patch("/:id", updateLeadController);
  app.post("/dedup", deduplicateLeadsController);
}