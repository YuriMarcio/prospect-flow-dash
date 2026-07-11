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
  clearCampaignLeadsController,
  getCampaignMetricsController,
} from "./prospecting-campaigns.controller";
import {
  getFlowController,
  saveFlowController,
  listIntentResponsesController,
  upsertIntentResponseController,
  deleteIntentResponseController,
  testAiClassificationController,
} from "../flows/flows.controller";
import { applyTemplateController } from "../flow-templates/flow-templates.controller";

export async function prospectingCampaignsRoutes(app: FastifyInstance) {
  app.get("/", listCampaignsController);
  app.post("/", createCampaignController);
  app.get("/:id", getCampaignController);
  app.patch("/:id", updateCampaignController);
  app.delete("/:id", deleteCampaignController);
  app.post("/:id/toggle", toggleCampaignController);
  app.get("/:id/status", getCampaignStatusController);
  app.get("/:id/metrics", getCampaignMetricsController);
  app.post("/:id/session/start", startCampaignSessionController);
  app.post("/:id/session/stop", stopCampaignSessionController);
  app.post("/:id/leads/clear", clearCampaignLeadsController);

  // Fluxo de mensagens (Visual Flow Builder)
  app.get("/:id/flow", getFlowController);
  app.put("/:id/flow", saveFlowController);
  app.post("/:id/flow/apply-template", applyTemplateController);

  // Respostas pré-aprovadas por intenção (IA)
  app.get("/:id/intent-responses", listIntentResponsesController);
  app.put("/:id/intent-responses/:intent", upsertIntentResponseController);
  app.delete("/:id/intent-responses/:intent", deleteIntentResponseController);
  app.post("/:id/ai/test", testAiClassificationController);
}
