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

function ownerId(request: FastifyRequest): string {
  return (request.user as { userId: string }).userId;
}

export async function connectController(
  request: FastifyRequest<{
    Params: { channel: string };
    Body: { instanceName: string; numberAge: "new" | "established" };
  }>,
  reply: FastifyReply,
) {
  const { instanceName, numberAge } = request.body;
  const result = await connectInstanceService(request.params.channel, ownerId(request), instanceName, numberAge);
  return reply.status(201).send(result);
}

export async function statusController(request: FastifyRequest, reply: FastifyReply) {
  const result = await getStatusService(ownerId(request));
  return reply.send(result);
}

export async function getConfigController(request: FastifyRequest, reply: FastifyReply) {
  const result = await getConfigService(ownerId(request));
  return reply.send(result);
}

export async function updateConfigController(
  request: FastifyRequest<{ Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const result = await updateConfigService(ownerId(request), request.body);
  return reply.send(result);
}

export async function toggleController(request: FastifyRequest, reply: FastifyReply) {
  const result = await toggleService(ownerId(request));
  return reply.send(result);
}

export async function listMessagesController(request: FastifyRequest, reply: FastifyReply) {
  const result = await listMessagesService(ownerId(request));
  return reply.send(result);
}

export async function createMessageController(
  request: FastifyRequest<{ Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const result = await createMessageService(ownerId(request), request.body);
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

export async function buildQueueController(request: FastifyRequest, reply: FastifyReply) {
  const result = await buildQueueService(ownerId(request));
  return reply.status(201).send(result);
}

export async function listQueueController(request: FastifyRequest, reply: FastifyReply) {
  const result = await listQueueService(ownerId(request));
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
  const result = await startSessionService(ownerId(request), request.body);
  return reply.send(result);
}

export async function stopSessionController(request: FastifyRequest, reply: FastifyReply) {
  const result = await stopSessionService(ownerId(request));
  return reply.send(result);
}

export async function listPlanController(request: FastifyRequest, reply: FastifyReply) {
  const result = await listPlanService(ownerId(request));
  return reply.send(result);
}

export async function assignPlanController(
  request: FastifyRequest<{ Body: { leadId: string; date: string } }>,
  reply: FastifyReply,
) {
  const result = await assignLeadToDayService(request.body.leadId, request.body.date, ownerId(request));
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
