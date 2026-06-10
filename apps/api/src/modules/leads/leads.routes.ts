import { FastifyInstance } from "fastify";
import {
  listLeadsController,
  getLeadController,
  updateLeadController,
  deduplicateLeadsController,
} from "./leads.controller";

export async function leadsRoutes(app: FastifyInstance) {
  app.get("/", listLeadsController);
  app.get("/:id", getLeadController);
  app.patch("/:id", updateLeadController);
  app.post("/dedup", deduplicateLeadsController);
}