import { FastifyRequest, FastifyReply } from "fastify";
import {
  createCampaignService,
  campaignleadsearchService,
  listCampaignsService,
  getCampaignService,
  startCampaignService,
} from "./campaigns.service";

export async function createCampaignController(
  request: FastifyRequest<{ Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  // Passando a bola pro service e retornando 201 (Created)
  const result = await createCampaignService(request.body);
  return reply.status(201).send(result);
}

export async function campaignleadsearchController(
  // Added Body definition here
  request: FastifyRequest<{ 
    Querystring: { leadId: string },
    Body: Record<string, unknown> 
  }>,
  reply: FastifyReply,
) {
  // TypeScript now knows request.body is Record<string, unknown>
  console.log("Received campaign lead search request with body:", request.body);
  const result = await campaignleadsearchService(request.body);
  return reply.status(201).send(result);
}

export async function listCampaignsController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const result = await listCampaignsService();
  return reply.send(result);
}

export async function getCampaignController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await getCampaignService(request.params.id);
  return reply.send(result);
}

export async function startCampaignController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await startCampaignService(request.params.id);
  return reply.send(result);
}
