import { FastifyRequest, FastifyReply } from "fastify";
import {
  createCampaignService,
  campaignleadsearchService,
  listCampaignsService,
  getCampaignService,
  startCampaignService,
  stopCampaignService,
  campaignInstagramSearchService,
  campaignInstaDeliverySearchService,
  campaignIfoodSearchService,
} from "./campaigns.service";

export async function createCampaignController(
  request: FastifyRequest<{ Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  // Passando a bola pro service e retornando 201 (Created)
  const result = await createCampaignService(request.body);
  return reply.status(201).send(result);
}

/** Erros de regra (ex.: campanha de destino inexistente) viram 400 com a mensagem, que a tela mostra. */
function replyError(error: unknown, reply: FastifyReply) {
  return reply.status(400).send({ error: error instanceof Error ? error.message : String(error) });
}

export async function campaignleadsearchController(
  // Added Body definition here
  request: FastifyRequest<{ 
    Querystring: { leadId: string },
    Body: Record<string, unknown> 
  }>,
  reply: FastifyReply,
) {
  // TypeScript now knows request.body is Record<string, unknown>
  console.log("Received campaign lead search request with body:", request.body);
  try {
    const result = await campaignleadsearchService(request.body);
    return reply.status(201).send(result);
  } catch (error) {
    return replyError(error, reply);
  }
}

export async function campaignleadsearchinstaController(
  request: FastifyRequest<{ Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  console.log("Busca recebida. Disparando bot INSTAGRAM em segundo plano...");

  // ⚠️ AQUI ESTAVA O ERRO: Tem que chamar o serviço do Insta, não o do iFood
  campaignInstagramSearchService(request.body).catch(err => {
     console.error("Erro na campanha em background:", err);
  });

  return reply.status(202).send({ message: "Campanha Insta iniciada com sucesso." });
}

export async function campaignInstaDeliveryController(
  request: FastifyRequest<{ Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  try {
    const result = await campaignInstaDeliverySearchService(request.body);
    return reply.status(201).send(result);
  } catch (error) {
    return replyError(error, reply);
  }
}

export async function campaignIfoodController(
  request: FastifyRequest<{ Body: Record<string, unknown> }>,
  reply: FastifyReply,
) {
  try {
    const result = await campaignIfoodSearchService(request.body);
    return reply.status(201).send(result);
  } catch (error) {
    return replyError(error, reply);
  }
}

export async function listCampaignsController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const result = await listCampaignsService();
  return reply.send(result);
}

export async function getCampaignController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await getCampaignService(request.params.id);
  return reply.send(result);
}

export async function startCampaignController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await startCampaignService(request.params.id);
  return reply.send(result);
}

export async function stopCampaignController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const result = await stopCampaignService(request.params.id);
  return reply.send(result);
}
