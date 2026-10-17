import axios from "axios";
import type { ScrapeCreatorsProfile } from "./instagram.profile";

/**
 * Consulta da bio de um perfil do Instagram. Único ponto que fala com o provedor pago/gratuito:
 * quem chama recebe sempre o mesmo formato (ScrapeCreatorsProfile) e trata 401/402/403 como
 * "provedor recusou" (ver providerRejection), seja qual for o provedor.
 *
 *   apify         plano grátis dá crédito mensal que renova (actor apify/instagram-profile-scraper)
 *   scrapecreators 100 créditos grátis uma única vez
 */

export type ProfileProvider = "apify" | "scrapecreators";

/**
 * PROFILE_PROVIDER força a escolha. Sem ele vale o que tiver chave configurada, Apify primeiro:
 * os créditos grátis do ScrapeCreators não renovam, então ele só entra quando é o único.
 */
export function resolveProfileProvider(env: NodeJS.ProcessEnv = process.env): ProfileProvider | null {
  const forced = env.PROFILE_PROVIDER?.trim().toLowerCase();
  if (forced === "apify" || forced === "scrapecreators") return forced;
  if (env.APIFY_TOKEN) return "apify";
  if (env.SCRAPECREATORS_API_KEY) return "scrapecreators";
  return null;
}

type HttpPost = <T>(
  url: string,
  body: unknown,
  config?: { headers?: Record<string, string>; params?: Record<string, unknown>; timeout?: number },
) => Promise<{ data: T }>;

type HttpGet = <T>(
  url: string,
  config?: { headers?: Record<string, string>; params?: Record<string, unknown>; timeout?: number },
) => Promise<{ data: T }>;

const axiosPost: HttpPost = (url, body, config) => axios.post(url, body, config);
const axiosGet: HttpGet = (url, config) => axios.get(url, config);

// ---------------------------------------------------------------------------
// APIFY
// ---------------------------------------------------------------------------

const APIFY_RUN_URL = "https://api.apify.com/v2/actors/apify~instagram-profile-scraper/run-sync-get-dataset-items";

/** Campos do item do dataset do actor que o LeadFlow usa. Perfil inexistente vem sem eles (ou com `error`). */
export interface ApifyProfileItem {
  username?: string;
  fullName?: string;
  biography?: string;
  externalUrl?: string | null;
  externalUrls?: Array<{ url?: string; lynx_url?: string }>;
  followersCount?: number;
  error?: string;
  errorDescription?: string;
}

/** Item do Apify → formato único do LeadFlow. Sem dados de perfil (não encontrado, erro) devolve null. */
export function apifyItemToProfile(item: ApifyProfileItem | null | undefined): ScrapeCreatorsProfile | null {
  if (!item || (item.error && !item.username)) return null;
  if (!item.username && !item.biography && !item.fullName) return null;

  const urls = (item.externalUrls ?? [])
    .map((link) => link.url ?? link.lynx_url)
    .filter((url): url is string => Boolean(url));
  if (item.externalUrl) urls.push(item.externalUrl);

  return {
    username: item.username,
    full_name: item.fullName,
    biography: item.biography,
    bio_links: [...new Set(urls)].map((url) => ({ url })),
    external_url: item.externalUrl ?? null,
    follower_count: item.followersCount,
  };
}

export async function fetchApifyProfile(
  handle: string,
  token: string,
  post: HttpPost = axiosPost,
): Promise<ScrapeCreatorsProfile | null> {
  const { data } = await post<ApifyProfileItem[]>(
    APIFY_RUN_URL,
    { usernames: [handle] },
    {
      headers: { Authorization: `Bearer ${token}` },
      params: { timeout: 90 }, // segundos de execução do actor; a chamada síncrona aceita até 300
      timeout: 120_000,
    },
  );

  return apifyItemToProfile(Array.isArray(data) ? data[0] : null);
}

// ---------------------------------------------------------------------------
// SCRAPECREATORS
// ---------------------------------------------------------------------------

export async function fetchScrapeCreatorsProfile(
  handle: string,
  apiKey: string,
  get: HttpGet = axiosGet,
): Promise<ScrapeCreatorsProfile | null> {
  const { data } = await get<ScrapeCreatorsProfile>("https://api.scrapecreators.com/v1/instagram/profile", {
    params: { handle },
    headers: { "x-api-key": apiKey },
    timeout: 15_000,
  });

  return data ?? null;
}

// ---------------------------------------------------------------------------
// ENTRADA ÚNICA
// ---------------------------------------------------------------------------

export async function fetchInstagramProfile(
  handle: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ScrapeCreatorsProfile | null> {
  const provider = resolveProfileProvider(env);
  if (!provider) {
    throw new Error("[ENRICHMENT] Nenhum provedor de perfis configurado: defina APIFY_TOKEN (ou SCRAPECREATORS_API_KEY) no .env");
  }

  if (provider === "apify") {
    if (!env.APIFY_TOKEN) throw new Error("[ENRICHMENT] APIFY_TOKEN não configurado no .env");
    return fetchApifyProfile(handle, env.APIFY_TOKEN);
  }

  if (!env.SCRAPECREATORS_API_KEY) throw new Error("[ENRICHMENT] SCRAPECREATORS_API_KEY não configurada no .env");
  return fetchScrapeCreatorsProfile(handle, env.SCRAPECREATORS_API_KEY);
}
