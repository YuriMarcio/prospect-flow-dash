import type { BotInstanceRow } from "../../modules/prospector/prospector.repository";

export interface DayConfig {
  enabled: boolean;
  limit: number;
}

export interface DispatchInterval {
  minIntervalMs: number;
  jitterMs: number;
}

/**
 * Aquecimento obrigatório só para números "new". Dias 1-3 = 5/dia,
 * 4-7 = 15/dia, 8-14 = 25/dia, depois disso libera o limite configurado.
 * Números "established" usam o limite configurado desde o dia 1.
 */
export function getEffectiveDailyLimit(instance: BotInstanceRow, dayConfig: DayConfig): number {
  if (!dayConfig.enabled) return 0;

  if (instance.number_age === "established" || instance.warming_done) {
    return dayConfig.limit;
  }

  const daysSinceConnect = getDaysSinceConnect(instance);
  const warmingCap = daysSinceConnect <= 3 ? 5 : daysSinceConnect <= 7 ? 15 : daysSinceConnect <= 14 ? 25 : Infinity;

  return Math.min(warmingCap, dayConfig.limit);
}

export function isWarmingDone(instance: BotInstanceRow): boolean {
  if (instance.number_age === "established") return true;
  return getDaysSinceConnect(instance) > 14;
}

function getDaysSinceConnect(instance: BotInstanceRow): number {
  if (!instance.connected_at) return 1;
  const connectedAt = new Date(instance.connected_at).getTime();
  const diffMs = Date.now() - connectedAt;
  return Math.floor(diffMs / 86_400_000) + 1;
}

/**
 * Número estabelecido com limite alto dispensa o intervalo de aquecimento
 * (15 min ±3 min) e usa um intervalo mais curto (7 min ±2 min).
 */
export function getDispatchInterval(instance: BotInstanceRow, effectiveDailyLimit: number): DispatchInterval {
  if (instance.number_age === "established" && effectiveDailyLimit >= 70) {
    return { minIntervalMs: 420_000, jitterMs: 120_000 };
  }
  return { minIntervalMs: 900_000, jitterMs: 180_000 };
}
