import { FastifyReply, FastifyRequest } from "fastify";
import {
  listPagesService,
  createPageService,
  duplicatePageService,
  updateMetaService,
  updateBlocksService,
  setFavoriteService,
  movePageService,
  reorderSiblingsService,
  deletePageService,
} from "./workspace.service";

function updatedBy(request: FastifyRequest): string {
  return (request.user as { name?: string; username?: string }).name ?? "Alguém";
}

export async function listPagesController(_request: FastifyRequest, reply: FastifyReply) {
  const result = await listPagesService();
  return reply.send(result);
}

export async function createPageController(
  request: FastifyRequest<{ Body: { id: string; parentId: string | null; title?: string; icon?: string } }>,
  reply: FastifyReply,
) {
  const result = await createPageService(request.body, updatedBy(request));
  return reply.status(201).send(result);
}

export async function duplicatePageController(
  request: FastifyRequest<{ Params: { id: string }; Body: { newId: string } }>,
  reply: FastifyReply,
) {
  try {
    const result = await duplicatePageService(request.params.id, request.body.newId, updatedBy(request));
    return reply.status(201).send(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return reply.status(400).send({ error: message });
  }
}

export async function updateMetaController(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { icon?: string; title?: string; description?: string; linkedBoardId?: string | null };
  }>,
  reply: FastifyReply,
) {
  const result = await updateMetaService(request.params.id, request.body, updatedBy(request));
  return reply.send(result);
}

export async function updateBlocksController(
  request: FastifyRequest<{ Params: { id: string }; Body: { blocks: Record<string, unknown>[] } }>,
  reply: FastifyReply,
) {
  const result = await updateBlocksService(request.params.id, request.body.blocks, updatedBy(request));
  return reply.send(result);
}

export async function setFavoriteController(
  request: FastifyRequest<{ Params: { id: string }; Body: { favorite: boolean } }>,
  reply: FastifyReply,
) {
  const result = await setFavoriteService(request.params.id, request.body.favorite);
  return reply.send(result);
}

export async function movePageController(
  request: FastifyRequest<{ Params: { id: string }; Body: { parentId: string | null } }>,
  reply: FastifyReply,
) {
  try {
    const result = await movePageService(request.params.id, request.body.parentId);
    return reply.send(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return reply.status(400).send({ error: message });
  }
}

export async function reorderSiblingsController(
  request: FastifyRequest<{ Body: { orderedIds: string[] } }>,
  reply: FastifyReply,
) {
  await reorderSiblingsService(request.body.orderedIds);
  return reply.status(204).send();
}

export async function deletePageController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await deletePageService(request.params.id);
  return reply.status(204).send();
}
