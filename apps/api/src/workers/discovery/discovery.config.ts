/**
 * Limites de gasto por campanha. Cada unidade é um crédito pago (SerpAPI ou ScrapeCreators).
 * Pontos de partida para medir (créditos por lead válido), não valores definitivos.
 */
export interface DiscoveryLimits {
  /** Buscas na SerpAPI: dorks do Instagram + Google Maps. */
  maxSearchRequests: number;
  /** Páginas por estratégia; só continua enquanto a página anterior produziu candidato novo. */
  maxPagesPerQuery: number;
  /** Buscas na SerpAPI para achar o Instagram de um negócio pelo nome. */
  maxLookupRequests: number;
  /** Consultas de perfil no ScrapeCreators (validar pendentes e enriquecer). */
  maxEnrichCalls: number;
  /** nfpr=1 nos dorks: pede à SerpAPI para não trocar a busca por uma correção automática. */
  useNfpr: boolean;
}

function readInt(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const parsed = Number(env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

export function loadLimits(env: NodeJS.ProcessEnv = process.env): DiscoveryLimits {
  return {
    maxSearchRequests: readInt(env, "DISCOVERY_MAX_SEARCH_REQUESTS", 15),
    maxPagesPerQuery: Math.max(1, readInt(env, "DISCOVERY_MAX_PAGES_PER_QUERY", 3)),
    maxLookupRequests: readInt(env, "DISCOVERY_MAX_LOOKUP_REQUESTS", 20),
    maxEnrichCalls: readInt(env, "DISCOVERY_MAX_ENRICH_CALLS", 25),
    useNfpr: env.DISCOVERY_SERP_NFPR !== "0",
  };
}
