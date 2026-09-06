import { FastifyReply, FastifyRequest } from "fastify";
import {
  listBoardsService,
  createBoardService,
  getBoardGraphService,
  renameBoardService,
  deleteBoardService,
  saveGraphService,
} from "./mind-maps.service";
import type { MindMapEdgeInput, MindMapNodeInput } from "./mind-maps.repository";

export async function listBoardsController(_request: FastifyRequest, reply: FastifyReply) {
  const result = await listBoardsService();
  return reply.send(result);
}

export async function createBoardController(
  request: FastifyRequest<{ Body: { name?: string } }>,
  reply: FastifyReply,
) {
  const result = await createBoardService(request.body?.name);
  return reply.status(201).send(result);
}

export async function getBoardController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const result = await getBoardGraphService(request.params.id);
    return reply.send(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return reply.status(404).send({ error: message });
  }
}

export async function saveGraphController(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { nodes: MindMapNodeInput[]; edges: MindMapEdgeInput[]; canvas?: Record<string, unknown> };
  }>,
  reply: FastifyReply,
) {
  try {
    const result = await saveGraphService(request.params.id, request.body);
    return reply.send(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return reply.status(400).send({ error: message });
  }
}

export async function renameBoardController(
  request: FastifyRequest<{ Params: { id: string }; Body: { name: string } }>,
  reply: FastifyReply,
) {
  try {
    const result = await renameBoardService(request.params.id, request.body.name);
    return reply.send(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return reply.status(400).send({ error: message });
  }
}

export async function deleteBoardController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await deleteBoardService(request.params.id);
  return reply.status(204).send();
}
