import axios from "axios";
import { parseInstagramBio } from "./instagram.parser";
import { runInstagramEnrichment } from "./instagram.enrichment.worker";
import { buildDiscoveryQueries, buildNicheMatcher, parseProfileLink } from "./instagram.filters";
import * as leadsRepository from "../../modules/leads/leads.repository";
import * as logsRepository from "../../modules/logs/logs.repository";
import * as campaignsRepository from "../../modules/campaigns/campaigns.repository";
import { isCancelled, cleanup } from "../../lib/cancellation";

// ---------------------------------------------------------------------------
// LOGGER — persiste no banco E no console
// ---------------------------------------------------------------------------

async function log(
  campaignId: string,
  message: string,
  level: "info" | "warn" | "error" = "info",
) {
  console.log(`[DISCOVERY] ${message}`);
  try {
    await logsRepository.create(campaignId, message, level);
  } catch {
    // não deixa falha de log derrubar o worker
  }
}

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

// O Google não entrega resultado útil além de ~100 por query (10 páginas de 10).
const MAX_PAGES_PER_QUERY = 10;

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

// ---------------------------------------------------------------------------
// WORKER PRINCIPAL
// ---------------------------------------------------------------------------

/**
 * Descobre leads via Google Dorking + SerpAPI.
 *
 * Estratégia de queries (em ordem de precisão) — ver buildDiscoveryQueries:
 *   1. site:instagram.com "hamburgueria" "São Luís"          → perfis diretos
 *   2. site:instagram.com "hamburgueria delivery" "São Luís" → com "delivery" na bio
 *   3. site:instagram.com "hamburgueria" "São Luís" "whatsapp" → com WA explícito na bio
 *
 * Cada resultado passa por dois filtros antes de virar lead: precisa ser URL de perfil
 * (não post/ajuda do Instagram) e mencionar o nicho buscado. Quando uma página inteira
 * vem sem nenhum resultado do nicho, o Google já relaxou a query e começou a devolver
 * perfis aleatórios — a query é encerrada ali, sem gastar mais créditos.
 */
export async function runInstagramDiscovery(
  campaignId: string,
  keyword: string,   // Ex: "hamburgueria", "hot dog", "japonês"
  city: string,      // Ex: "São Luís", "São Paulo"
  quantity: number,
  prospectingCampaignId?: string,  // painel (campanha de prospecção) que recebe os leads; sem ele vão pro Kanban geral
): Promise<void> {
  await campaignsRepository.updateStats(campaignId, { status: "running", processed: 0, found: 0 });
  await log(campaignId, `Iniciando busca: "${keyword}" em "${city}" | meta: ${quantity} leads`);

  const queries = buildDiscoveryQueries(keyword, city);
  const isRelevant = buildNicheMatcher(keyword);

  const leadsFound: DiscoveryLead[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    if (leadsFound.length >= quantity) break;
    if (isCancelled(campaignId)) break;

    await log(campaignId, `Query: ${query}`);

    for (let page = 0; page < MAX_PAGES_PER_QUERY && leadsFound.length < quantity; page++) {
      if (isCancelled(campaignId)) break;
      const results = await searchGoogle(query, page * 10);

      if (results.length === 0) {
        await log(campaignId, `Página ${page + 1} vazia. Encerrando esta query.`, "warn");
        break;
      }

      let relevant = 0;
      let discarded = 0;

      for (const result of results) {
        if (leadsFound.length >= quantity) break;

        const snippet = result.snippet ?? "";
        const profile = parseProfileLink(result.link);

        if (!profile || !isRelevant({ title: result.title, snippet, handle: profile.handle })) {
          discarded++;
          console.log(`[DISCOVERY] descartado: ${result.title} | ${result.link}`);
          continue;
        }

        relevant++;
        if (seenUrls.has(profile.url)) continue;
        seenUrls.add(profile.url);

        const parsedBio = parseInstagramBio(snippet);

        const lead: DiscoveryLead = {
          name: extractNameFromTitle(result.title) || "Desconhecido",
          instagram: profile.url,
          notes: snippet,
          whatsapp: parsedBio.whatsapp,
          linktree: parsedBio.linktree,
          delivery_link: parsedBio.digitalMenu,
        };

        leadsFound.push(lead);

        await log(
          campaignId,
          `#${leadsFound.length} | ${lead.name} | WA: ${lead.whatsapp ?? "—"} | ${profile.url}`,
        );

        const saved = await leadsRepository.createUnique({
          campaign_id: campaignId,
          category: keyword,
          city,
          source: "instagram",
          ...(prospectingCampaignId ? { prospecting_campaign_id: prospectingCampaignId } : {}),
          ...lead,
        });

        let counted = saved.created;
        if (!saved.created) {
          // Repetido: se solto e há campanha de destino, entra nela em vez de ser descartado
          const outcome = prospectingCampaignId
            ? await leadsRepository.adoptDuplicate(saved.lead, prospectingCampaignId)
            : "other";
          if (outcome === "adopted") {
            counted = true;
            await log(campaignId, `Lead já existia e foi adicionado à campanha: ${lead.name}`);
          } else {
            await log(campaignId, `Lead repetido ignorado: ${lead.name}`, "warn");
          }
        }

        if (counted) {
          // Incrementa contadores em tempo real
          await campaignsRepository.updateStats(campaignId, {
            processed: leadsFound.length,
            found: leadsFound.length,
          });
        }
      }

      await log(campaignId, `Página ${page + 1}: ${relevant} do nicho, ${discarded} descartados.`);

      if (relevant === 0) {
        await log(campaignId, `Resultados saíram do nicho "${keyword}". Encerrando esta query.`, "warn");
        break;
      }

      await delay(1200);
    }
  }

  const wasCancelled = isCancelled(campaignId);
  cleanup(campaignId);

  if (wasCancelled) {
    await log(campaignId, `Captura interrompida. ${leadsFound.length} leads salvos até o momento.`, "warn");
    return;
  }

  await log(campaignId, `Concluído. Total salvo: ${leadsFound.length} leads`);
  await campaignsRepository.updateStats(campaignId, {
    status: "done",
    processed: leadsFound.length,
    found: leadsFound.length,
  });
  await runInstagramEnrichment(campaignId);
}