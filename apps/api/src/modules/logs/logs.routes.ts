import { FastifyInstance } from "fastify";
import { getCampaignLogsController } from "./logs.controller";

export async function logsRoutes(app: FastifyInstance) {
  app.get("/campaign/:campaignId", getCampaignLogsController);
}