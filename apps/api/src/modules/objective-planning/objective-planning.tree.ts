import type { AuthUser } from "../auth/auth.service";
import type { ObjectiveTreeNode } from "../objectives/objective-tree";
import type { PlannerTaskDraft } from "./objective-planning.types";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Casa o nome falado pela IA contra a equipe cadastrada — sem match exato, mantém só o texto livre. */
export function resolveOwner(
  ownerName: string | null,
  users: Pick<AuthUser, "id" | "name" | "username">[],
): { owner: string | null; assignedUserId: string | null } {
  if (!ownerName?.trim()) return { owner: null, assignedUserId: null };
  const target = normalize(ownerName);
  const match = users.find(
    (u) => (u.name && normalize(u.name) === target) || (u.username && normalize(u.username) === target),
  );
  return match ? { owner: match.name ?? match.username, assignedUserId: match.id } : { owner: ownerName, assignedUserId: null };
}

/** Rascunho da IA → árvore pronta pra criar, já com o responsável casado com a equipe cadastrada. */
export function toTreeNode(
  draft: PlannerTaskDraft & { kind?: "objective" | "task" },
  users: Pick<AuthUser, "id" | "name" | "username">[],
): ObjectiveTreeNode {
  const { owner, assignedUserId } = resolveOwner(draft.owner, users);
  return {
    title: draft.title,
    description: draft.description,
    dueDate: draft.dueDate,
    owner,
    assignedUserId,
    kind: draft.kind,
    area: draft.area,
    priority: draft.priority,
    done: draft.done,
    children: (draft.tasks ?? []).map((task) => toTreeNode(task, users)),
  };
}
