import axios from "axios";
import { parseInstagramBio } from "./instagram.parser";
import { runInstagramEnrichment } from "./instagram.enrichment.worker";
import * as leadsRepository from "../../modules/leads/leads.repository";

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------

export interface DiscoveryLead {
  name: string;
  instagram: string;
  notes: string;
  whatsapp: string | null;
  linktree: string | null;
  delivery_link: string | null;
}

interface SerpResult {
  title: string;
  link: string;
  snippet: string;
}

interface SerpResponse {
  organic_results?: SerpResult[];
  error?: string;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * Chama a SerpAPI com uma query de Google Dorking.
 * Cada chamada consome 1 crédito. Free tier: 100/mês.
 * Plano pago: ~$50/mês para 5.000 req → R$0,05/lead capturado.
 */
async function searchGoogle(query: string, start = 0): Promise<SerpResult[]> {
  const SERP_API_KEY = process.env.SERP_API_KEY;

  if (!SERP_API_KEY) {
    throw new Error("[DISCOVERY] SERP_API_KEY não configurada no .env");
  }

  const params = {
    api_key: SERP_API_KEY,
    engine: "google",
    q: query,
    start,          // paginação: 0 = pág 1, 10 = pág 2, 20 = pág 3 ...
    num: 10,
    hl: "pt",
    gl: "br",
  };

  const response = await axios.get<SerpResponse>(
    "https://serpapi.com/search",
    { params },
  );

  if (response.data.error) {
    throw new Error(`[DISCOVERY] SerpAPI erro: ${response.data.error}`);
  }

  return response.data.organic_results ?? [];
}

/**
 * Extrai o nome limpo do título que o Google mostra para perfis do Instagram.
 * Formato típico: "Burger Kings SLZ (@burgerkingsslz) • Fotos e vídeos do Instagram"
 */
function extractNameFromTitle(title: string): string {
  return title
    .split("(")[0]           // remove (@handle)
    .replace("- Instagram", "")
    .replace("| Instagram", "")
    .trim();
}

/**
 * Valida se o link é de um perfil real (não post, reel ou stories).
 */
function isProfileUrl(url: string): boolean {
  if (!url.includes("instagram.com")) return false;
  if (url.includes("/p/")) return false;
  if (url.includes("/reel/")) return false;
  if (url.includes("/stories/")) return false;
  if (url.includes("/explore/")) return false;
  return true;
}

// ---------------------------------------------------------------------------
// WORKER PRINCIPAL
// ---------------------------------------------------------------------------

/**
 * Descobre leads via Google Dorking + SerpAPI.
 *
 * Estratégia de queries (em ordem de precisão):
 *   1. site:instagram.com "hamburgueria" "São Luís"          → perfis diretos
 *   2. site:instagram.com "hamburgueria delivery" "São Luís" → com "delivery" na bio
 *   3. site:instagram.com "lanches" "São Luís" "whatsapp"    → com WA explícito na bio
 *
 * O Google retorna ~100 resultados únicos por query antes de repetir.
 * Com 3 queries por categoria, você chega facilmente a 200–300 leads por cidade.
 */
export async function runInstagramDiscovery(
  campaignId: string,
  keyword: string,   // Ex: "hamburgueria", "hot dog", "japonês"
  city: string,      // Ex: "São Luís", "São Paulo"
  quantity: number,
): Promise<void> {
  console.log(`[DISCOVERY] Iniciando busca: "${keyword}" em "${city}" | meta: ${quantity} leads`);

  // Monta variações da query para maximizar cobertura
  const queries = [
    `site:instagram.com "${keyword}" "${city}"`,
    `site:instagram.com "${keyword} delivery" "${city}"`,
    `site:instagram.com "${keyword}" "${city}" "whatsapp"`,
  ];

  const leadsFound: DiscoveryLead[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    if (leadsFound.length >= quantity) break;

    let page = 0;
    let emptyPages = 0;

    console.log(`[DISCOVERY] Query: ${query}`);

    while (leadsFound.length < quantity && emptyPages < 2) {
      const results = await searchGoogle(query, page * 10);

      if (results.length === 0) {
        emptyPages++;
        console.log(`[DISCOVERY] Página ${page + 1} vazia. (${emptyPages}/2 antes de parar)`);
        break;
      }

      for (const result of results) {
        if (leadsFound.length >= quantity) break;

        const url = result.link;

        // Ignora se não for perfil ou já foi visto
        if (!isProfileUrl(url) || seenUrls.has(url)) continue;
        seenUrls.add(url);

        const name = extractNameFromTitle(result.title);
        const snippet = result.snippet ?? "";

        const parsedBio = parseInstagramBio(snippet);

        const lead: DiscoveryLead = {
          name: name || "Desconhecido",
          instagram: url,
          notes: snippet,
          whatsapp: parsedBio.whatsapp,
          linktree: parsedBio.linktree,
          delivery_link: parsedBio.digitalMenu,
        };

        leadsFound.push(lead);

        console.log(
          `[DISCOVERY] #${leadsFound.length} | ${lead.name} | WA: ${lead.whatsapp ?? "—"} | ${url}`,
        );

        // Salva no banco sem duplicar
        const saved = await leadsRepository.createUnique({
          campaign_id: campaignId,
          category: keyword,
          city,
          source: "instagram",
          ...lead,
        });

        if (!saved.created) {
          console.log(`[DISCOVERY] Lead repetido ignorado: ${lead.name}`);
        }
      }

      page++;

      // Pausa entre páginas para não estourar rate limit da SerpAPI
      // (plano free: 1 req/s; plano pago: 5 req/s)
      await delay(1200);
    }
  }

  console.log(
    `[DISCOVERY] Concluído. Total salvo: ${leadsFound.length} leads para campanha ${campaignId}`,
  );

  await runInstagramEnrichment(campaignId);
}