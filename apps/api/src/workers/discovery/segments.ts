import { normalizeLoose } from "../../lib/text";

/** Teto de segmentos por captura: cada um roda a descoberta completa e gasta o próprio orçamento. */
export const MAX_SEGMENTS = 5;

/**
 * Segmentos escolhidos na captura. Aceita `categories` (lista) ou, para clientes antigos,
 * `category` (texto). Remove vazios e repetidos (sem diferenciar maiúsculas/acentos).
 */
export function resolveSegments(data: { categories?: unknown; category?: unknown }): string[] {
  const raw = Array.isArray(data.categories) && data.categories.length > 0 ? data.categories : [data.category];

  const seen = new Set<string>();
  const segments: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const segment = item.trim();
    const key = normalizeLoose(segment);
    if (!segment || seen.has(key)) continue;
    seen.add(key);
    segments.push(segment);
  }
  return segments;
}
