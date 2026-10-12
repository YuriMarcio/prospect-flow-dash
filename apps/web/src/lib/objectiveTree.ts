import type { Objective } from "@/lib/objectives";

/**
 * A hierarquia é toda feita com `parentObjectiveId`:
 * objetivo (topo) → marco → issue → subissue.
 */

export function isDone(objective: Objective): boolean {
  return objective.progress >= 100;
}

/** Filhos de cada item, na ordem em que foram criados. */
export function buildChildrenMap(objectives: Objective[]): Map<string, Objective[]> {
  const map = new Map<string, Objective[]>();
  for (const objective of objectives) {
    if (!objective.parentObjectiveId) continue;
    const siblings = map.get(objective.parentObjectiveId) ?? [];
    siblings.push(objective);
    map.set(objective.parentObjectiveId, siblings);
  }
  for (const siblings of map.values()) siblings.sort((a, b) => a.order - b.order);
  return map;
}

export function averageProgress(items: Objective[]): number {
  if (items.length === 0) return 0;
  return Math.round(items.reduce((sum, item) => sum + item.progress, 0) / items.length);
}

/**
 * Quem tem filhos tem progresso = média do progresso deles (recursivo). É o
 * mesmo cálculo do servidor; aplicar aqui deixa a tela coerente na hora,
 * antes da resposta do servidor voltar.
 */
export function applyDerivedProgress(objectives: Objective[]): Objective[] {
  const childrenMap = buildChildrenMap(objectives);
  const memo = new Map<string, number>();
  const visiting = new Set<string>();

  function progressOf(objective: Objective): number {
    const cached = memo.get(objective.id);
    if (cached !== undefined) return cached;
    const children = childrenMap.get(objective.id);
    // `visiting` só protege contra um ciclo de pais corrompido — nesse caso trata como folha.
    if (!children?.length || visiting.has(objective.id)) return objective.progress;
    visiting.add(objective.id);
    const progress = Math.round(children.reduce((sum, child) => sum + progressOf(child), 0) / children.length);
    visiting.delete(objective.id);
    memo.set(objective.id, progress);
    return progress;
  }

  return objectives.map((objective) => {
    const progress = progressOf(objective);
    return progress === objective.progress ? objective : { ...objective, progress };
  });
}

/** O item e todos os descendentes dele (o que some junto quando ele é excluído). */
export function collectSubtreeIds(objectives: Objective[], rootId: string): Set<string> {
  const childrenMap = buildChildrenMap(objectives);
  const ids = [rootId];
  for (let i = 0; i < ids.length; i += 1) {
    for (const child of childrenMap.get(ids[i]) ?? []) ids.push(child.id);
  }
  return new Set(ids);
}

export interface MilestoneStats {
  done: number;
  total: number;
}

/** Marcos concluídos / total de cada objetivo (os marcos são os filhos diretos). */
export function buildMilestoneStats(
  roots: Objective[],
  childrenMap: Map<string, Objective[]>,
): Record<string, MilestoneStats> {
  const stats: Record<string, MilestoneStats> = {};
  for (const root of roots) {
    const milestones = childrenMap.get(root.id) ?? [];
    if (milestones.length === 0) continue;
    stats[root.id] = { done: milestones.filter(isDone).length, total: milestones.length };
  }
  return stats;
}
