import { FastifyRequest, FastifyReply } from "fastify";
import {
  connectInstanceService,
  getStatusService,
  getConfigService,
  updateConfigService,
  toggleService,
  listMessagesService,
  createMessageService,
  updateMessageService,
  deleteMessageService,
  uploadMediaService,
  buildQueueService,
  listQueueService,
  listLogsService,
  handleWebhookService,
  startSessionService,
  stopSessionService,
  listPlanService,
  assignLeadToDayService,
  unassignLeadService,
} from "./prospector.service";

export async function connectController(
  request: FastifyRequest<{
    Params: { channel: string };
    Body: { instanceName: string; numberAge: "new" | "established" };
  }>,
  reply: FastifyReply,
) {
  const { instanceName, numberAge } = request.body;
  const result = await connectInstanceService(request.params.channel, instanceName, numberAge);
  return reply.status(201).send(result);
}

export async function statusController(_request: FastifyRequest, reply: FastifyReply) {
  const result = await getStatusService();
  return reply.send(result);
}

export async function getConfigController(_request: FastifyRequest, reply: FastifyReply) {
  const result = await getConfigService();
  return reply.send(result);
}

export async function updateConfigController(
  request: FastifyRequest<{ Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const result = await updateConfigService(request.body);
  return reply.send(result);
}

export async function toggleController(_request: FastifyRequest, reply: FastifyReply) {
  const result = await toggleService();
  return reply.send(result);
}

export async function listMessagesController(_request: FastifyRequest, reply: FastifyReply) {
  const result = await listMessagesService();
  return reply.send(result);
}

export async function createMessageController(
  request: FastifyRequest<{ Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const result = await createMessageService(request.body);
  return reply.status(201).send(result);
}

export async function updateMessageController(
  request: FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const result = await updateMessageService(request.params.id, request.body);
  return reply.send(result);
}

export async function deleteMessageController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await deleteMessageService(request.params.id);
  return reply.status(204).send();
}

export async function uploadMediaController(
  request: FastifyRequest<{ Body: { fileName: string; mimeType: string; dataBase64: string } }>,
  reply: FastifyReply,
) {
  const result = await uploadMediaService(request.body);
  return reply.status(201).send(result);
}

export async function buildQueueController(_request: FastifyRequest, reply: FastifyReply) {
  const result = await buildQueueService();
  return reply.status(201).send(result);
}

export async function listQueueController(_request: FastifyRequest, reply: FastifyReply) {
  const result = await listQueueService();
  return reply.send(result);
}

export async function listLogsController(_request: FastifyRequest, reply: FastifyReply) {
  const result = await listLogsService();
  return reply.send(result);
}

export async function startSessionController(
  request: FastifyRequest<{ Body: { mode: "until_done" | "custom"; startAt?: string; endAt?: string } }>,
  reply: FastifyReply,
) {
  const result = await startSessionService(request.body);
  return reply.send(result);
}

export async function stopSessionController(_request: FastifyRequest, reply: FastifyReply) {
  const result = await stopSessionService();
  return reply.send(result);
}

export async function listPlanController(_request: FastifyRequest, reply: FastifyReply) {
  const result = await listPlanService();
  return reply.send(result);
}

export async function assignPlanController(
  request: FastifyRequest<{ Body: { leadId: string; date: string } }>,
  reply: FastifyReply,
) {
  const result = await assignLeadToDayService(request.body.leadId, request.body.date);
  return reply.status(201).send(result);
}

export async function unassignPlanController(
  request: FastifyRequest<{ Params: { leadId: string } }>,
  reply: FastifyReply,
) {
  await unassignLeadService(request.params.leadId);
  return reply.status(204).send();
}

export async function webhookController(
  request: FastifyRequest<{ Params: { channel: string }; Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  await handleWebhookService(request.params.channel, request.body).catch((err) => {
    console.error("[PROSPECTOR] Erro ao processar webhook:", err);
  });
  return reply.status(200).send({ ok: true });
}
