import { FastifyInstance } from "fastify";

import {
  createCampaignController,
  listCampaignsController,
  getCampaignController,
  startCampaignController
} from "./campaigns.controller";

export async function campaignsRoutes(
  app: FastifyInstance
) {
  app.get(
    "/",
    listCampaignsController
  );

  app.get(
    "/:id",
    getCampaignController
  );

  app.post(
    "/",
    createCampaignController
  );

  app.post(
    "/:id/start",
    startCampaignController
  );
}