import { FastifyInstance } from "fastify";
import { createRequire } from "module";

import {
  createCampaignController,
  listCampaignsController,
  getCampaignController,
  startCampaignController,
  campaignleadsearchController,
  campaignleadsearchinstaController,
  campaignInstaDeliveryController,
} from "./campaigns.controller";

const require = createRequire(import.meta.url);
const instaDeliveryCities: string[] = require("../../data/instadelivery-cities.json");

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

  app.get("/instadelivery/cities", async (_req, reply) => {
    return reply.send(instaDeliveryCities);
  });

  app.post("/campaigninstadelivery", campaignInstaDeliveryController);
}