import { FastifyReply, FastifyRequest } from "fastify";
import {
  appendTurn,
  cancelSession,
  confirmSession,
  getOrCreateActiveSession,
  getSessionOrThrow,
} from "./workspace-planning.service";

function userId(request: FastifyRequest): string {
  return (request.user as { userId: string }).userId;
}

async function requireOwnSession(request: FastifyRequest<{ Params: { id: string } }>) {
  const session = await getSessionOrThrow(request.params.id);
  if (session.owner_user_id !== userId(request)) {
    throw new Error("Sessão não pertence a você.");
  }
  return session;
}

export async function getActiveSessionController(request: FastifyRequest, reply: FastifyReply) {
  const session = await getOrCreateActiveSession(userId(request), "web");
  return reply.send(session);
}

export async function appendTurnController(
  request: FastifyRequest<{ Params: { id: string }; Body: { text?: string } }>,
  reply: FastifyReply,
) {
  try {
    const session = await requireOwnSession(request);

    let text: string | undefined;
    let audioBase64: string | undefined;
    let audioMimeType: string | undefined;

    if (request.isMultipart()) {
      const file = await request.file({ limits: { fileSize: 15 * 1024 * 1024 } });
      if (!file) return reply.status(400).send({ error: "Nenhum áudio enviado." });
      audioBase64 = (await file.toBuffer()).toString("base64");
      audioMimeType = file.mimetype;
    } else {
      text = request.body?.text;
    }

    const updated = await appendTurn(session, { text, audioBase64, audioMimeType });
    return reply.send(updated);
  } catch (error: unknown) {
    return reply.status(400).send({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function confirmSessionController(
  request: FastifyRequest<{ Params: { id: string }; Body: { createdPageId: string } }>,
  reply: FastifyReply,
) {
  try {
    const session = await requireOwnSession(request);
    const updated = await confirmSession(session, request.body.createdPageId);
    return reply.send(updated);
  } catch (error: unknown) {
    return reply.status(400).send({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function cancelSessionController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const session = await requireOwnSession(request);
    const updated = await cancelSession(session);
    return reply.send(updated);
  } catch (error: unknown) {
    return reply.status(400).send({ error: error instanceof Error ? error.message : String(error) });
  }
}
