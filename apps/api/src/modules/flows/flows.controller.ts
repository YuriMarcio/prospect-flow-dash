import { FastifyReply, FastifyRequest } from "fastify";
import { getFlowService, saveFlowService } from "./flows.service";
import type { FlowEdgeInput, FlowNodeInput } from "./flows.repository";
import * as intentResponsesRepository from "./intent-responses.repository";
import * as campaignsRepository from "../prospecting-campaigns/prospecting-campaigns.repository";
import { classifyReplyWithAI } from "../../workers/prospector/ai-classifier";
import { resolveEntryMessage } from "../../workers/prospector/flow-engine";
import { isGeminiConfigured } from "../../lib/gemini";

export async function getFlowController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await getFlowService(request.params.id);
  return reply.send(result);
}

export async function saveFlowController(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { nodes: FlowNodeInput[]; edges: FlowEdgeInput[]; canvas?: Record<string, unknown> };
  }>,
  reply: FastifyReply,
) {
  try {
    const result = await saveFlowService(request.params.id, request.body);
    return reply.send(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return reply.status(400).send({ error: message });
  }
}

export async function listIntentResponsesController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await intentResponsesRepository.findAll(request.params.id);
  return reply.send(result);
}

export async function upsertIntentResponseController(
  request: FastifyRequest<{
    Params: { id: string; intent: string };
    Body: { message_id: string; personalize?: boolean; enabled?: boolean };
  }>,
  reply: FastifyReply,
) {
  if (!request.body?.message_id) {
    return reply.status(400).send({ error: "message_id é obrigatório." });
  }
  const result = await intentResponsesRepository.upsert(request.params.id, request.params.intent, {
    message_id: request.body.message_id,
    personalize: request.body.personalize ?? true,
    enabled: request.body.enabled ?? true,
  });
  return reply.send(result);
}

export async function deleteIntentResponseController(
  request: FastifyRequest<{ Params: { id: string; intent: string } }>,
  reply: FastifyReply,
) {
  await intentResponsesRepository.remove(request.params.id, request.params.intent);
  return reply.status(204).send();
}

/** Caixa "testar classificação" da aba IA do board. */
export async function testAiClassificationController(
  request: FastifyRequest<{ Params: { id: string }; Body: { text: string } }>,
  reply: FastifyReply,
) {
  if (!isGeminiConfigured()) {
    return reply.status(400).send({ error: "GEMINI_API_KEY não configurada no servidor." });
  }
  if (!request.body?.text?.trim()) {
    return reply.status(400).send({ error: "Informe um texto para classificar." });
  }

  const campaign = await campaignsRepository.findById(request.params.id);
  const entry = await resolveEntryMessage(request.params.id);
  const lastSentText =
    entry?.message.bot_message_blocks.find((block) => block.type === "text")?.content ?? "";

  const result = await classifyReplyWithAI(
    {
      leadName: "Lead de teste",
      leadSegment: campaign?.segment ?? null,
      lastSentText,
      replyText: request.body.text,
      elapsedMs: 5 * 60_000,
    },
    { model: campaign?.ai_config?.model, campaignId: request.params.id },
  );

  if (!result) {
    return reply.status(502).send({ error: "IA indisponível no momento. Tente novamente." });
  }
  return reply.send(result);
}
