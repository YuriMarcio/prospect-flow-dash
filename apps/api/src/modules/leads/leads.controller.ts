import { FastifyRequest, FastifyReply } from "fastify";
import { listLeadsService, getLeadService, updateLeadService, deduplicateLeadsService, listCitiesService } from "./leads.service";

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

export async function updateLeadController(request: FastifyRequest<{ Params: { id: string }, Body: any }>, reply: FastifyReply) {
  const result = await updateLeadService(request.params.id, request.body);
  return reply.send(result);
}

export async function deduplicateLeadsController(request: FastifyRequest, reply: FastifyReply) {
  const result = await deduplicateLeadsService();
  return reply.send(result);
}