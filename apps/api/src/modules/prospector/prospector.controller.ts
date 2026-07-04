import { FastifyRequest, FastifyReply } from "fastify";
import {
  connectInstanceService,
  getInstanceStatusService,
  listMessagesService,
  createMessageService,
  updateMessageService,
  deleteMessageService,
  uploadMediaService,
  buildQueueService,
  listQueueService,
  listLogsService,
  handleWebhookService,
  listPlanService,
  assignLeadToDayService,
  unassignLeadService,
} from "./prospector.service";

function ownerId(request: FastifyRequest): string {
  return (request.user as { userId: string }).userId;
}

function campaignId(request: FastifyRequest<{ Querystring?: { campaignId?: string } }>): string {
  const id = request.query?.campaignId;
  if (!id) throw new Error("Informe campaignId.");
  return id;
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

export async function instanceStatusController(request: FastifyRequest, reply: FastifyReply) {
  const result = await getInstanceStatusService(ownerId(request));
  return reply.send(result);
}

export async function listMessagesController(
  request: FastifyRequest<{ Querystring: { campaignId?: string } }>,
  reply: FastifyReply,
) {
  const result = await listMessagesService(campaignId(request));
  return reply.send(result);
}

export async function createMessageController(
  request: FastifyRequest<{ Querystring: { campaignId?: string }; Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  const result = await createMessageService(campaignId(request), request.body);
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

export async function buildQueueController(
  request: FastifyRequest<{ Querystring: { campaignId?: string } }>,
  reply: FastifyReply,
) {
  const result = await buildQueueService(campaignId(request));
  return reply.status(201).send(result);
}

export async function listQueueController(
  request: FastifyRequest<{ Querystring: { campaignId?: string } }>,
  reply: FastifyReply,
) {
  const result = await listQueueService(campaignId(request));
  return reply.send(result);
}

export async function listLogsController(
  request: FastifyRequest<{ Querystring: { campaignId?: string } }>,
  reply: FastifyReply,
) {
  const result = await listLogsService(request.query?.campaignId);
  return reply.send(result);
}

export async function listPlanController(
  request: FastifyRequest<{ Querystring: { campaignId?: string } }>,
  reply: FastifyReply,
) {
  const result = await listPlanService(campaignId(request));
  return reply.send(result);
}

export async function assignPlanController(
  request: FastifyRequest<{ Body: { leadId: string; date: string; campaignId: string } }>,
  reply: FastifyReply,
) {
  const result = await assignLeadToDayService(request.body.leadId, request.body.date, request.body.campaignId);
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
