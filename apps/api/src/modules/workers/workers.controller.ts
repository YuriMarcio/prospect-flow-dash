import { FastifyRequest, FastifyReply } from "fastify";
import { getWorkerStatusService } from "./workers.service";

export async function getWorkerStatusController(request: FastifyRequest, reply: FastifyReply) {
  const result = await getWorkerStatusService();
  return reply.send(result);
}