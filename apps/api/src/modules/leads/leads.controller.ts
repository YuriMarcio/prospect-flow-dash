import { FastifyRequest, FastifyReply } from "fastify";
import { listLeadsService, getLeadService, updateLeadService } from "./leads.service";

export async function listLeadsController(request: FastifyRequest, reply: FastifyReply) {
  const result = await listLeadsService();
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