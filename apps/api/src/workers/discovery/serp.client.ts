import axios from "axios";
import { normalizeLoose } from "../../lib/text";
import { UF_NAMES, normalizeUf } from "./location";

/**
 * Único ponto de contato com a SerpAPI. Quem chama decide se pode gastar (ver Budget):
 * cada `searchGoogle`/`searchMaps` consome 1 crédito; `resolveLocation` é gratuito.
 */

export interface SerpOrganicResult {
  title: string;
  link: string;
  snippet: string;
}

/** Estabelecimento do Google Maps (`local_results`). Só `title` é garantido. */
export interface MapsPlace {
  title: string;
  place_id?: string;
  data_id?: string;
  address?: string;
  phone?: string;
  website?: string;
  type?: string;
  types?: string[];
  rating?: number;
  reviews?: number;
}

export interface SerpClient {
  searchMaps(params: { query: string; start?: number }): Promise<MapsPlace[]>;
  searchGoogle(params: { query: string; start?: number; location?: string | null; nfpr?: boolean }): Promise<SerpOrganicResult[]>;
  resolveLocation(city: string, state?: string | null): Promise<string | null>;
}

interface SerpResponse {
  organic_results?: SerpOrganicResult[];
  error?: string;
}

interface SerpMapsResponse {
  local_results?: MapsPlace[];
  place_results?: MapsPlace;
  error?: string;
}

/** A SerpAPI devolve "hasn't returned any results" como erro; para nós é só página vazia. */
const isEmptySearch = (error: string) => /hasn'?t returned any results|no results/i.test(error);

interface SerpLocation {
  canonical_name: string;
  country_code: string;
  target_type: string;
}

type HttpGet = <T>(url: string, config?: { params?: Record<string, unknown>; timeout?: number }) => Promise<{ data: T }>;

const SERP_BASE = "https://serpapi.com";

const axiosGet: HttpGet = (url, config) => axios.get(url, config);

const RETRY_DELAY_MS = 1500;

/** Timeout, queda de rede ou 5xx: vale uma segunda tentativa. 4xx (chave, plano, parâmetro) não. */
function isTransient(err: unknown): boolean {
  const failure = err as { code?: string; message?: string; response?: { status?: number } };
  if (failure.response?.status !== undefined) return failure.response.status >= 500;
  return Boolean(failure.code === "ECONNABORTED" || failure.code === "ETIMEDOUT" || /timeout|network|socket/i.test(failure.message ?? ""));
}

export function createSerpClient(
  apiKey: string,
  rawHttp: HttpGet = axiosGet,
  retryDelayMs = RETRY_DELAY_MS,
): SerpClient {
  const locationCache = new Map<string, string | null>();

  // Uma tentativa extra para falha transitória: um timeout não deve encerrar uma estratégia que rendia.
  const http: HttpGet = async (url, config) => {
    try {
      return await rawHttp(url, config);
    } catch (err) {
      if (!isTransient(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      return rawHttp(url, config);
    }
  };

  return {
    async searchGoogle({ query, start = 0, location, nfpr }) {
      const response = await http<SerpResponse>(`${SERP_BASE}/search`, {
        params: {
          api_key: apiKey,
          engine: "google",
          q: query,
          start, // 0 = pág 1, 10 = pág 2, 20 = pág 3 ...
          num: 10,
          hl: "pt",
          gl: "br",
          ...(location ? { location } : {}),
          ...(nfpr ? { nfpr: 1 } : {}),
        },
        timeout: 30_000,
      });

      if (response.data.error) {
        if (isEmptySearch(response.data.error)) return [];
        throw new Error(`[DISCOVERY] SerpAPI erro: ${response.data.error}`);
      }
      return response.data.organic_results ?? [];
    },

    async searchMaps({ query, start = 0 }) {
      const response = await http<SerpMapsResponse>(`${SERP_BASE}/search`, {
        params: {
          api_key: apiKey,
          engine: "google_maps",
          type: "search",
          q: query,
          start, // de 20 em 20; a SerpAPI recomenda parar em 100
          hl: "pt",
          gl: "br",
        },
        timeout: 30_000,
      });

      if (response.data.error) {
        if (isEmptySearch(response.data.error)) return [];
        throw new Error(`[DISCOVERY] SerpAPI Maps erro: ${response.data.error}`);
      }

      // Busca que resolve para um único lugar vem em `place_results`, não em `local_results`.
      if (response.data.local_results) return response.data.local_results;
      return response.data.place_results ? [response.data.place_results] : [];
    },

    /**
     * Nome canônico da cidade para o parâmetro `location` ("Santa Ines,State of Maranhao,Brazil").
     * Só orienta a origem geográfica da busca; não garante que os resultados sejam da cidade.
     * Sem UF não dá para desambiguar cidades homônimas, então não resolve.
     */
    async resolveLocation(city, state) {
      const uf = normalizeUf(state);
      if (!uf) return null;

      const key = `${normalizeLoose(city)}|${uf}`;
      if (locationCache.has(key)) return locationCache.get(key) ?? null;

      let found: string | null = null;
      try {
        const { data } = await http<SerpLocation[]>(`${SERP_BASE}/locations.json`, {
          params: { q: normalizeLoose(city), limit: 10 },
          timeout: 15_000,
        });
        const stateName = normalizeLoose(UF_NAMES[uf]);
        found =
          data.find(
            (item) =>
              item.country_code === "BR" &&
              item.target_type === "City" &&
              normalizeLoose(item.canonical_name).includes(stateName),
          )?.canonical_name ?? null;
      } catch {
        found = null; // localização é só um reforço: sem ela a busca segue com gl=br
      }

      locationCache.set(key, found);
      return found;
    },
  };
}
