import { randomUUID } from "node:crypto";
import type { ObjectiveRow } from "./objectives.repository";

export const OBJECTIVE_AREAS = ["vendas", "marketing", "administrativo", "desenvolvimento"] as const;
export const OBJECTIVE_PRIORITIES = ["critica", "alta", "media", "baixa"] as const;

/** Níveis abaixo do objetivo: marco (1) → issue (2) → subissue (3). */
export const MAX_DEPTH = 3;

/** Um item de uma árvore a criar de uma vez: o de topo vira card no board, os filhos ficam dentro dele. */
export interface ObjectiveTreeNode {
  title: string;
  description?: string;
  dueDate?: string | null;
  owner?: string | null;
  assignedUserId?: string | null;
  /** Só vale no topo: "task" = tarefa avulsa (mesmo card de um objetivo, só muda o rótulo). */
  kind?: "objective" | "task";
  area?: string | null;
  priority?: string | null;
  /** Item já concluído (progresso 100). Em quem tem filhos o progresso é a média deles. */
  done?: boolean;
  children?: ObjectiveTreeNode[];
}

export type NewObjectiveRow = Pick<
  ObjectiveRow,
  | "id"
  | "column_id"
  | "title"
  | "description"
  | "progress"
  | "due_date"
  | "owner"
  | "order"
  | "kind"
  | "parent_objective_id"
  | "assigned_user_id"
  | "area"
  | "priority"
  | "code_number"
>;

function oneOf(value: string | null | undefined, allowed: readonly string[], label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (!allowed.includes(value)) throw new Error(`${label} inválida: "${value}".`);
  return value;
}

/**
 * Transforma uma lista de árvores em linhas prontas pra inserir (uma consulta só, em vez de uma por item).
 * Aplica as mesmas regras de createObjectiveService: código sequencial e ordem só pros itens de topo,
 * ordem entre irmãos, limite de níveis e progresso do pai = média dos filhos.
 * A área é herdada do pai quando o filho não traz a própria.
 */
export function buildObjectiveTreeRows(
  roots: ObjectiveTreeNode[],
  options: { columnId: string; existing: ObjectiveRow[]; newId?: () => string },
): NewObjectiveRow[] {
  if (roots.length === 0) throw new Error("Não há nenhum item para criar.");
  const newId = options.newId ?? randomUUID;

  const topLevel = options.existing.filter((o) => !o.parent_objective_id);
  let nextOrder = topLevel.filter((o) => o.column_id === options.columnId).length;
  let nextCode = Math.max(0, ...topLevel.map((o) => o.code_number ?? 0)) + 1;

  const rows: NewObjectiveRow[] = [];

  /** Devolve o progresso do item (calculado depois de visitar os filhos). */
  function visit(
    node: ObjectiveTreeNode,
    depth: number,
    parentId: string | null,
    order: number,
    inheritedArea: string | null,
  ): number {
    const title = node.title?.trim();
    if (!title) throw new Error("Todo item precisa de um título.");
    const children = node.children ?? [];
    if (children.length > 0 && depth >= MAX_DEPTH) {
      throw new Error(`Limite de níveis atingido em "${title}" (objetivo → marco → issue → subissue).`);
    }

    const area = oneOf(node.area, OBJECTIVE_AREAS, "Área") ?? inheritedArea;
    const priority = oneOf(node.priority, OBJECTIVE_PRIORITIES, "Prioridade");
    const isRoot = depth === 0;

    const row: NewObjectiveRow = {
      id: newId(),
      column_id: isRoot ? options.columnId : null,
      title,
      description: node.description?.trim() ?? "",
      progress: node.done ? 100 : 0,
      due_date: node.dueDate || null,
      owner: node.owner || null,
      order: isRoot ? nextOrder++ : order,
      kind: isRoot ? (node.kind ?? "objective") : "task",
      parent_objective_id: parentId,
      assigned_user_id: node.assignedUserId ?? null,
      area,
      priority,
      code_number: isRoot ? nextCode++ : null,
    };
    rows.push(row);

    if (children.length > 0) {
      const childProgress = children.map((child, index) => visit(child, depth + 1, row.id, index, area));
      row.progress = Math.round(childProgress.reduce((sum, p) => sum + p, 0) / childProgress.length);
    }
    return row.progress;
  }

  roots.forEach((root) => visit(root, 0, null, 0, null));
  return rows;
}
