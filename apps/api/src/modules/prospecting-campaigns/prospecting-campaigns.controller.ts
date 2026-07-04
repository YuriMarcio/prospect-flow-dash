import { FastifyReply, FastifyRequest } from "fastify";
import {
  listCampaignsService,
  getCampaignService,
  createCampaignService,
  updateCampaignService,
  toggleCampaignService,
  deleteCampaignService,
  getCampaignStatusService,
  startCampaignSessionService,
  stopCampaignSessionService,
} from "./prospecting-campaigns.service";

function userId(request: FastifyRequest): string {
  return (request.user as { userId: string }).userId;
}

export async function listCampaignsController(_request: FastifyRequest, reply: FastifyReply) {
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

export async function createCampaignController(
  request: FastifyRequest<{
    Body: {
      name: string;
      ownerUserId: string;
      region?: string | null;
      segment?: string | null;
      filters?: { cities: string[]; segments: string[] };
      schedule?: Record<string, { enabled: boolean; limit: number }>;
      windowStart?: string;
      windowEnd?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const result = await createCampaignService({
    ...request.body,
    createdByUserId: userId(request),
  });
  return reply.status(201).send(result);
}

export async function deleteCampaignController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await deleteCampaignService(request.params.id);
  return reply.status(204).send();
}

export async function updateCampaignController(
  request: FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const result = await updateCampaignService(request.params.id, request.body);
  return reply.send(result);
}

export async function toggleCampaignController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await toggleCampaignService(request.params.id);
  return reply.send(result);
}

export async function getCampaignStatusController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await getCampaignStatusService(request.params.id);
  return reply.send(result);
}

export async function startCampaignSessionController(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { mode: "until_done" | "custom"; startAt?: string; endAt?: string };
  }>,
  reply: FastifyReply,
) {
  const result = await startCampaignSessionService(request.params.id, request.body);
  return reply.send(result);
}

export async function stopCampaignSessionController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await stopCampaignSessionService(request.params.id);
  return reply.send(result);
}
