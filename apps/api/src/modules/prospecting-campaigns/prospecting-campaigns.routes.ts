import { FastifyInstance } from "fastify";
import {
  listCampaignsController,
  getCampaignController,
  createCampaignController,
  updateCampaignController,
  toggleCampaignController,
  deleteCampaignController,
  getCampaignStatusController,
  startCampaignSessionController,
  stopCampaignSessionController,
} from "./prospecting-campaigns.controller";

export async function prospectingCampaignsRoutes(app: FastifyInstance) {
  app.get("/", listCampaignsController);
  app.post("/", createCampaignController);
  app.get("/:id", getCampaignController);
  app.patch("/:id", updateCampaignController);
  app.delete("/:id", deleteCampaignController);
  app.post("/:id/toggle", toggleCampaignController);
  app.get("/:id/status", getCampaignStatusController);
  app.post("/:id/session/start", startCampaignSessionController);
  app.post("/:id/session/stop", stopCampaignSessionController);
}
