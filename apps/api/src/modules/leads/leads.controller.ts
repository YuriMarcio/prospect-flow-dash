import { FastifyRequest, FastifyReply } from "fastify";
import {
  listLeadsService,
  getLeadService,
  updateLeadService,
  deduplicateLeadsService,
  listCitiesService,
  createLeadService,
  LeadError,
} from "./leads.service";

/** Erros esperados viram {error} com o status certo; o resto continua sendo 500. */
function replyLeadError(error: unknown, reply: FastifyReply) {
  if (error instanceof LeadError) return reply.status(error.statusCode).send({ error: error.message });
  throw error;
}

export async function listLeadsController(request: FastifyRequest, reply: FastifyReply) {
  const result = await listLeadsService();
  return reply.send(result);
}

export async function listCitiesController(_request: FastifyRequest, reply: FastifyReply) {
  const result = await listCitiesService();
  return reply.send(result);
}

export async function getLeadController(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const result = await getLeadService(request.params.id);
  return reply.send(result);
}

export async function createLeadController(request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) {
  try {
    const { lead, adopted } = await createLeadService(request.body);
    return reply.status(adopted ? 200 : 201).send({ ...lead, adopted });
  } catch (error) {
    return replyLeadError(error, reply);
  }
}

export async function updateLeadController(request: FastifyRequest<{ Params: { id: string }, Body: any }>, reply: FastifyReply) {
  try {
    const result = await updateLeadService(request.params.id, (request.body ?? {}) as Record<string, unknown>);
    return reply.send(result);
  } catch (error) {
    return replyLeadError(error, reply);
  }
}

export async function deduplicateLeadsController(request: FastifyRequest, reply: FastifyReply) {
  const result = await deduplicateLeadsService();
  return reply.send(result);
}