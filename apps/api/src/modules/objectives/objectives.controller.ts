import { FastifyReply, FastifyRequest } from "fastify";
import {
  listColumnsService,
  createColumnService,
  updateColumnService,
  reorderColumnsService,
  deleteColumnService,
  listObjectivesService,
  createObjectiveService,
  updateObjectiveService,
  deleteObjectiveService,
  listSprintsService,
  createSprintService,
  deleteSprintService,
} from "./objectives.service";

export async function listColumnsController(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await listColumnsService());
}

export async function createColumnController(
  request: FastifyRequest<{ Body: { title: string } }>,
  reply: FastifyReply,
) {
  try {
    const result = await createColumnService(request.body.title);
    return reply.status(201).send(result);
  } catch (error: unknown) {
    return reply.status(400).send({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function updateColumnController(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { title?: string; color?: string; isDone?: boolean };
  }>,
  reply: FastifyReply,
) {
  const { title, color, isDone } = request.body;
  const patch: { title?: string; color?: string; is_done?: boolean } = {};
  if (title !== undefined) patch.title = title;
  if (color !== undefined) patch.color = color;
  if (isDone !== undefined) patch.is_done = isDone;
  return reply.send(await updateColumnService(request.params.id, patch));
}

export async function reorderColumnsController(
  request: FastifyRequest<{ Body: { orderedIds: string[] } }>,
  reply: FastifyReply,
) {
  await reorderColumnsService(request.body.orderedIds);
  return reply.status(204).send();
}

export async function deleteColumnController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    await deleteColumnService(request.params.id);
    return reply.status(204).send();
  } catch (error: unknown) {
    return reply.status(400).send({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function listObjectivesController(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await listObjectivesService());
}

export async function createObjectiveController(
  request: FastifyRequest<{
    Body: { columnId: string; title: string; description?: string; dueDate?: string | null; owner?: string | null };
  }>,
  reply: FastifyReply,
) {
  try {
    const { columnId, title, description, dueDate, owner } = request.body;
    const result = await createObjectiveService({ columnId, title, description, dueDate, owner });
    return reply.status(201).send(result);
  } catch (error: unknown) {
    return reply.status(400).send({ error: error instanceof Error ? error.message : String(error) });
  }
}

interface UpdateObjectiveBody {
  columnId?: string;
  order?: number;
  title?: string;
  description?: string;
  progress?: number;
  dueDate?: string | null;
  owner?: string | null;
  status?: string;
  linkedPageId?: string | null;
  sprintId?: string | null;
  assignedUserId?: string | null;
}

export async function updateObjectiveController(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateObjectiveBody }>,
  reply: FastifyReply,
) {
  const body = request.body;
  const patch: Record<string, unknown> = {};
  if (body.columnId !== undefined) patch.column_id = body.columnId;
  if (body.order !== undefined) patch.order = body.order;
  if (body.title !== undefined) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.progress !== undefined) patch.progress = body.progress;
  if (body.dueDate !== undefined) patch.due_date = body.dueDate;
  if (body.owner !== undefined) patch.owner = body.owner;
  if (body.status !== undefined) patch.status = body.status;
  if (body.linkedPageId !== undefined) patch.linked_page_id = body.linkedPageId;
  if (body.sprintId !== undefined) patch.sprint_id = body.sprintId;
  if (body.assignedUserId !== undefined) patch.assigned_user_id = body.assignedUserId;

  const result = await updateObjectiveService(request.params.id, patch);
  return reply.send(result);
}

export async function deleteObjectiveController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await deleteObjectiveService(request.params.id);
  return reply.status(204).send();
}

export async function listSprintsController(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await listSprintsService());
}

export async function createSprintController(
  request: FastifyRequest<{ Body: { name: string; startDate: string; endDate: string } }>,
  reply: FastifyReply,
) {
  try {
    const result = await createSprintService(request.body);
    return reply.status(201).send(result);
  } catch (error: unknown) {
    return reply.status(400).send({ error: error instanceof Error ? error.message : String(error) });
  }
}

export async function deleteSprintController(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  await deleteSprintService(request.params.id);
  return reply.status(204).send();
}
