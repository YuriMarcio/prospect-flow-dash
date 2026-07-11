import { FastifyReply, FastifyRequest } from "fastify";
import {
  listTemplatesService,
  createTemplateFromCampaignService,
  deleteTemplateService,
  applyTemplateService,
} from "./flow-templates.service";

export async function listTemplatesController(_request: FastifyRequest, reply: FastifyReply) {
  const result = await listTemplatesService();
  return reply.send(result);
}

export async function createTemplateController(
  request: FastifyRequest<{ Body: { campaignId: string; name: string; description?: string } }>,
  reply: FastifyReply,
) {
  try {
    const result = await createTemplateFromCampaignService(request.body);
    return reply.status(201).send(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return reply.status(400).send({ error: message });
  }
}

export async function deleteTemplateController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await deleteTemplateService(request.params.id);
  return reply.status(204).send();
}

export async function applyTemplateController(
  request: FastifyRequest<{ Params: { id: string }; Body: { templateId: string } }>,
  reply: FastifyReply,
) {
  try {
    const result = await applyTemplateService(request.params.id, request.body.templateId);
    return reply.send(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return reply.status(400).send({ error: message });
  }
}
