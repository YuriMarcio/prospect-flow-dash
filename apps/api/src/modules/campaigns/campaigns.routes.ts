import { FastifyInstance } from "fastify";

import {
  createCampaignController,
  listCampaignsController,
  getCampaignController,
  startCampaignController,
  campaignleadsearchController,
  campaignleadsearchinstaController
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
    "/campaignleadsearch",
    campaignleadsearchController
  );
  app.post(
    "/campaignleadsearchinsta",
    campaignleadsearchinstaController
  );

  app.post(
    "/:id/start",
    startCampaignController
  );
}