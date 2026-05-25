import { FastifyReply, FastifyRequest } from "fastify";
import { getDashboardService } from "./dashboard.service";

export async function getDashboardController(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const result = await getDashboardService();
  return reply.send(result);
}
