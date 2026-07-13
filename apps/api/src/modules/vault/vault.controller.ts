import { FastifyReply, FastifyRequest } from "fastify";
import {
  addApiKeyService,
  addAttachmentService,
  createEntryService,
  deleteApiKeyService,
  deleteAttachmentService,
  deleteEntryService,
  getAttachmentDownloadUrlService,
  getEntryService,
  listEntriesService,
  toggleFavoriteService,
  updateEntryService,
  type VaultEntryPayload,
} from "./vault.service";

function userId(request: FastifyRequest): string {
  return (request.user as { userId: string }).userId;
}

function handleError(reply: FastifyReply, err: unknown) {
  const message = err instanceof Error ? err.message : "Erro inesperado.";
  const status = message === "Entrada não encontrada." || message === "Anexo não encontrado." ? 404 : 400;
  return reply.status(status).send({ error: message });
}

export async function listEntriesController(request: FastifyRequest, reply: FastifyReply) {
  const result = await listEntriesService(userId(request));
  return reply.send(result);
}

export async function getEntryController(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  try {
    const result = await getEntryService(request.params.id, userId(request));
    return reply.send(result);
  } catch (err) {
    return handleError(reply, err);
  }
}

export async function createEntryController(
  request: FastifyRequest<{ Body: VaultEntryPayload }>,
  reply: FastifyReply,
) {
  try {
    const result = await createEntryService(userId(request), request.body ?? ({} as VaultEntryPayload));
    return reply.status(201).send(result);
  } catch (err) {
    return handleError(reply, err);
  }
}

export async function updateEntryController(
  request: FastifyRequest<{ Params: { id: string }; Body: Partial<VaultEntryPayload> }>,
  reply: FastifyReply,
) {
  try {
    const result = await updateEntryService(request.params.id, userId(request), request.body ?? {});
    return reply.send(result);
  } catch (err) {
    return handleError(reply, err);
  }
}

export async function deleteEntryController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    await deleteEntryService(request.params.id, userId(request));
    return reply.status(204).send();
  } catch (err) {
    return handleError(reply, err);
  }
}

export async function toggleFavoriteController(
  request: FastifyRequest<{ Params: { id: string }; Body: { favorite?: boolean } }>,
  reply: FastifyReply,
) {
  try {
    const favorite = Boolean(request.body?.favorite);
    const result = await toggleFavoriteService(request.params.id, userId(request), favorite);
    return reply.send(result);
  } catch (err) {
    return handleError(reply, err);
  }
}

export async function addApiKeyController(
  request: FastifyRequest<{ Params: { id: string }; Body: { label?: string; value?: string } }>,
  reply: FastifyReply,
) {
  try {
    const result = await addApiKeyService(
      request.params.id,
      userId(request),
      request.body?.label ?? "",
      request.body?.value ?? "",
    );
    return reply.status(201).send(result);
  } catch (err) {
    return handleError(reply, err);
  }
}

export async function deleteApiKeyController(
  request: FastifyRequest<{ Params: { id: string; keyId: string } }>,
  reply: FastifyReply,
) {
  try {
    const result = await deleteApiKeyService(request.params.id, userId(request), request.params.keyId);
    return reply.send(result);
  } catch (err) {
    return handleError(reply, err);
  }
}

export async function uploadAttachmentController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const file = await request.file();
    if (!file) return reply.status(400).send({ error: "Nenhum arquivo enviado." });

    const buffer = await file.toBuffer();
    const result = await addAttachmentService(request.params.id, userId(request), file.filename, buffer, file.mimetype);
    return reply.status(201).send(result);
  } catch (err) {
    return handleError(reply, err);
  }
}

export async function deleteAttachmentController(
  request: FastifyRequest<{ Params: { id: string; attId: string } }>,
  reply: FastifyReply,
) {
  try {
    const result = await deleteAttachmentService(request.params.id, userId(request), request.params.attId);
    return reply.send(result);
  } catch (err) {
    return handleError(reply, err);
  }
}

export async function downloadAttachmentController(
  request: FastifyRequest<{ Params: { id: string; attId: string } }>,
  reply: FastifyReply,
) {
  try {
    const result = await getAttachmentDownloadUrlService(request.params.id, userId(request), request.params.attId);
    return reply.send(result);
  } catch (err) {
    return handleError(reply, err);
  }
}
