import axios from "axios";
import { findInstagramProfile } from "../instagram/instagram.search";
import { runInstagramEnrichment } from "../instagram/instagram.enrichment.worker";
import * as leadsRepository from "../../modules/leads/leads.repository";
import * as logsRepository from "../../modules/logs/logs.repository";
import * as campaignsRepository from "../../modules/campaigns/campaigns.repository";
import { isCancelled, cleanup } from "../../lib/cancellation";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// Teto de chamadas à Gecko por campanha: cada chamada gasta crédito, e uma API que repete a
// mesma página (cursor que não avança) não pode virar laço infinito.
const MAX_GECKO_REQUESTS = 100;

async function log(
  campaignId: string,
  message: string,
  level: "info" | "warn" | "error" = "info",
) {
  console.log(`[IFOOD] ${message}`);
  try {
    await logsRepository.create(campaignId, message, level);
  } catch {
    // não deixa falha de log derrubar o worker
  }
}

interface GeckoMerchant {
  name?: string;
  title?: string;
  url?: string;
  slug?: string;
  address?: string;
  location?: string;
  fullAddress?: string;
  [key: string]: unknown;
}

interface GeckoResponse {
  data?: {
    merchants?: GeckoMerchant[];
    results?: GeckoMerchant[];
    nextCursor?: string | null;
  };
  merchants?: GeckoMerchant[];
  results?: GeckoMerchant[];
  nextCursor?: string | null;
}

function extractMerchants(payload: GeckoResponse): GeckoMerchant[] {
  const list =
    payload.data?.merchants ??
    payload.data?.results ??
    payload.merchants ??
    payload.results ??
    [];
  return Array.isArray(list) ? list : [];
}

async function fetchMerchantsPage(
  zipCode: string,
  category: string,
  page: number,
  cursor?: string | null,
): Promise<{ merchants: GeckoMerchant[]; nextCursor: string | null }> {
  const response = await axios.post<GeckoResponse>(
    "https://api.geckoapi.com.br/v1/extract",
    {
      target: "ifood.com.br",
      type: "plp",
      keyword: category,
      zipCode,
      page,
      ...(cursor ? { cursor } : {}),
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GECKO_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 20_000,
    },
  );

  return {
    merchants: extractMerchants(response.data),
    nextCursor: response.data.data?.nextCursor ?? response.data.nextCursor ?? null,
  };
}

function buildIfoodUrl(merchant: GeckoMerchant): string {
  if (merchant.url) return merchant.url;
  if (merchant.slug) return `https://www.ifood.com.br/delivery/brasil/${merchant.slug}`;
  return "";
}

export async function runIfoodScraping(
  campaignId: string,
  city: string,
  zipCode: string,
  category: string,
  quantity: number,
  prospectingCampaignId?: string,  // painel (campanha de prospecção) que recebe os leads; sem ele vão pro Kanban geral
): Promise<void> {
  if (!process.env.GECKO_API_KEY) {
    await log(campaignId, `GECKO_API_KEY não configurada no .env. Abortando.`, "error");
    await campaignsRepository.updateStatus(campaignId, "error");
    return;
  }

  const cleanZipCode = zipCode.replace(/\D/g, "");

  await campaignsRepository.updateStats(campaignId, { status: "running", processed: 0, found: 0 });
  await log(campaignId, `Iniciando busca iFood: "${category}" no CEP ${cleanZipCode} (${city}) | meta: ${quantity}`);

  let processed = 0;
  let found = 0;
  let page = 1;
  let cursor: string | null = null;
  const seenUrls = new Set<string>();
  let geckoRequests = 0;

  try {
    while (found < quantity) {
      if (isCancelled(campaignId)) break;

      if (++geckoRequests > MAX_GECKO_REQUESTS) {
        await log(campaignId, `Limite de ${MAX_GECKO_REQUESTS} chamadas à Gecko atingido. Encerrando busca.`, "warn");
        break;
      }

      const { merchants, nextCursor } = await fetchMerchantsPage(cleanZipCode, category, page, cursor);

      if (merchants.length === 0) {
        await log(campaignId, `Página ${page} sem restaurantes. Encerrando busca na Gecko.`, "warn");
        break;
      }

      let newOnPage = 0;
      for (const merchant of merchants) {
        if (found >= quantity) break;
        if (isCancelled(campaignId)) break;

        const name = merchant.name || merchant.title || "Nome não informado";
        const ifoodUrl = buildIfoodUrl(merchant);
        const address = merchant.address || merchant.fullAddress || merchant.location || "";

        // Sem URL, o nome serve de chave — senão um item sem URL repetido nunca seria reconhecido como repetido.
        const seenKey = ifoodUrl || name;
        if (seenUrls.has(seenKey)) continue;
        seenUrls.add(seenKey);
        newOnPage++;

        processed++;

        // Repetido (por nome+cidade ou por outro campo único): se solto e há campanha de destino,
        // é adotado por ela; senão é pulado como sempre.
        const existing = await leadsRepository.findByNameAndCity(name, city);
        if (existing) {
          const outcome = prospectingCampaignId
            ? await leadsRepository.adoptDuplicate(existing, prospectingCampaignId)
            : "other";
          if (outcome === "adopted") found++;
          await log(
            campaignId,
            outcome === "adopted"
              ? `[${processed}] ${name} | ADOTADO (já existia, agora está na campanha)`
              : `[${processed}] ${name} | PULANDO (já existe no banco)`,
          );
          await campaignsRepository.updateStats(campaignId, { processed, found });
          continue;
        }

        const result = await leadsRepository.createUnique({
          campaign_id: campaignId,
          name,
          ifood_url: ifoodUrl || undefined,
          address: address || undefined,
          zip_code: cleanZipCode,
          city,
          category,
          source: "ifood",
          ...(prospectingCampaignId ? { prospecting_campaign_id: prospectingCampaignId } : {}),
        });

        if (!result.created) {
          const outcome = prospectingCampaignId
            ? await leadsRepository.adoptDuplicate(result.lead, prospectingCampaignId)
            : "other";
          if (outcome === "adopted") found++;
          await log(
            campaignId,
            `[${processed}] ${name} | ${outcome === "adopted" ? "ADOTADO (já existia, agora está na campanha)" : "DUPLICADO"}`,
          );
          await campaignsRepository.updateStats(campaignId, { processed, found });
          continue;
        }
        const lead = result.lead;

        found++;

        const instaResult = await findInstagramProfile(null, name, city);
        if (instaResult) {
          await leadsRepository.update(lead.id, {
            instagram: instaResult.url,
            notes: instaResult.bioSnippet,
          });
        }

        await log(
          campaignId,
          `[${processed}] ${name} | IG: ${instaResult ? instaResult.url : "—"} | SALVO`,
        );
        await campaignsRepository.updateStats(campaignId, { processed, found });
        await delay(1200);
      }

      // Página que só trouxe restaurantes já vistos: a API não está avançando, continuar só gastaria créditos.
      if (newOnPage === 0 && !isCancelled(campaignId)) {
        await log(campaignId, `Página ${page} sem restaurantes novos. Encerrando busca na Gecko.`, "warn");
        break;
      }

      if (!nextCursor) {
        page++;
      }
      cursor = nextCursor;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await log(campaignId, `Erro crítico na busca Gecko: ${message}`, "error");
    await campaignsRepository.updateStatus(campaignId, "error");
    return;
  }

  const wasCancelled = isCancelled(campaignId);
  cleanup(campaignId);

  if (wasCancelled) {
    await log(campaignId, `Captura interrompida. ${found} leads salvos de ${processed} processados.`, "warn");
    return;
  }

  await log(campaignId, `Busca iFood concluída. ${found} leads salvos. Iniciando enriquecimento do Instagram...`);
  await campaignsRepository.updateStats(campaignId, { status: "done", processed, found });
  await runInstagramEnrichment(campaignId);
}
