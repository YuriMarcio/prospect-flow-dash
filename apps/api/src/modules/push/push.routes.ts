import { FastifyInstance } from "fastify";
import { publicKeyController, subscribeController, testController, unsubscribeController } from "./push.controller";

export async function pushRoutes(app: FastifyInstance) {
  app.get("/public-key", publicKeyController);
  app.post("/subscribe", subscribeController);
  app.post("/unsubscribe", unsubscribeController);
  app.post("/test", testController);
}
