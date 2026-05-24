import { FastifyRequest, FastifyReply } from "fastify";
import {
  createCampaignService,
  listCampaignsService,
  getCampaignService,
  startCampaignService
} from "./campaigns.service";

export async function createCampaignController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Passando a bola pro service e retornando 201 (Created)
  const result = await createCampaignService(request.body);
  return reply.status(201).send(result);
}

export async function listCampaignsController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const result = await listCampaignsService();
  return reply.send(result);
}

export async function getCampaignController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const result = await getCampaignService(request.params.id);
  return reply.send(result);
}

export async function startCampaignController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const result = await startCampaignService(request.params.id);
  return reply.send(result);
}