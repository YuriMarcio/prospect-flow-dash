import { FastifyRequest, FastifyReply } from "fastify";
import { getCampaignLogsService } from "./logs.service";

export async function getCampaignLogsController(request: FastifyRequest<{ Params: { campaignId: string } }>, reply: FastifyReply) {
  const result = await getCampaignLogsService(request.params.campaignId);
  return reply.send(result);
}