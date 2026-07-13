import { FastifyInstance } from "fastify";
import {
  connectController,
  instanceStatusController,
  listMessagesController,
  createMessageController,
  updateMessageController,
  deleteMessageController,
  uploadMediaController,
  buildQueueController,
  listQueueController,
  listQueueHistoryController,
  listPlanController,
  assignPlanController,
  unassignPlanController,
  listLogsController,
  webhookController,
} from "./prospector.controller";

export async function prospectorRoutes(app: FastifyInstance) {
  app.post("/connect/:channel", connectController);
  app.get("/instance-status", instanceStatusController);

  app.get("/messages", listMessagesController);
  app.post("/messages", createMessageController);
  app.put("/messages/:id", updateMessageController);
  app.delete("/messages/:id", deleteMessageController);
  app.post("/media", uploadMediaController);

  app.post("/queue/build", buildQueueController);
  app.get("/queue", listQueueController);
  app.get("/queue/history", listQueueHistoryController);

  app.get("/plan", listPlanController);
  app.post("/plan", assignPlanController);
  app.delete("/plan/:leadId", unassignPlanController);

  app.get("/logs", listLogsController);

  app.post("/webhook/:channel", webhookController);
}
