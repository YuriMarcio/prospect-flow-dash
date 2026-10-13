export type SpendKind = "search" | "lookup" | "enrich";

/** Contador de créditos por tipo de gasto. `spend` só debita se ainda houver saldo. */
export class Budget {
  private readonly used: Record<SpendKind, number> = { search: 0, lookup: 0, enrich: 0 };

  constructor(private readonly limits: Record<SpendKind, number>) {}

  remaining(kind: SpendKind): number {
    return Math.max(0, this.limits[kind] - this.used[kind]);
  }

  spend(kind: SpendKind): boolean {
    if (this.remaining(kind) === 0) return false;
    this.used[kind]++;
    return true;
  }

  usedOf(kind: SpendKind): number {
    return this.used[kind];
  }

  totalUsed(): number {
    return this.used.search + this.used.lookup + this.used.enrich;
  }
}
