import { FastifyInstance } from "fastify";
import {
  connectController,
  statusController,
  getConfigController,
  updateConfigController,
  toggleController,
  startSessionController,
  stopSessionController,
  listMessagesController,
  createMessageController,
  updateMessageController,
  deleteMessageController,
  uploadMediaController,
  buildQueueController,
  listQueueController,
  listPlanController,
  assignPlanController,
  unassignPlanController,
  listLogsController,
  webhookController,
} from "./prospector.controller";

export async function prospectorRoutes(app: FastifyInstance) {
  app.post("/connect/:channel", connectController);
  app.get("/status", statusController);
  app.get("/config", getConfigController);
  app.put("/config", updateConfigController);
  app.post("/toggle", toggleController);
  app.post("/session/start", startSessionController);
  app.post("/session/stop", stopSessionController);

  app.get("/messages", listMessagesController);
  app.post("/messages", createMessageController);
  app.put("/messages/:id", updateMessageController);
  app.delete("/messages/:id", deleteMessageController);
  app.post("/media", uploadMediaController);

  app.post("/queue/build", buildQueueController);
  app.get("/queue", listQueueController);

  app.get("/plan", listPlanController);
  app.post("/plan", assignPlanController);
  app.delete("/plan/:leadId", unassignPlanController);

  app.get("/logs", listLogsController);

  app.post("/webhook/:channel", webhookController);
}
