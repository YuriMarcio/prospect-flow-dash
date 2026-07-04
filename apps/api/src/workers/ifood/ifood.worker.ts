import axios from "axios";
import { findInstagramProfile } from "../instagram/instagram.search";
import { runInstagramEnrichment } from "../instagram/instagram.enrichment.worker";
import * as leadsRepository from "../../modules/leads/leads.repository";
import * as logsRepository from "../../modules/logs/logs.repository";
import * as campaignsRepository from "../../modules/campaigns/campaigns.repository";
import { isCancelled, cleanup } from "../../lib/cancellation";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

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

  try {
    while (found < quantity) {
      if (isCancelled(campaignId)) break;

      const { merchants, nextCursor } = await fetchMerchantsPage(cleanZipCode, category, page, cursor);

      if (merchants.length === 0) {
        await log(campaignId, `Página ${page} sem restaurantes. Encerrando busca na Gecko.`, "warn");
        break;
      }

      for (const merchant of merchants) {
        if (found >= quantity) break;
        if (isCancelled(campaignId)) break;

        const name = merchant.name || merchant.title || "Nome não informado";
        const ifoodUrl = buildIfoodUrl(merchant);
        const address = merchant.address || merchant.fullAddress || merchant.location || "";

        if (ifoodUrl && seenUrls.has(ifoodUrl)) continue;
        if (ifoodUrl) seenUrls.add(ifoodUrl);

        processed++;

        const alreadyExists = await leadsRepository.existsByNameAndCity(name, city);
        if (alreadyExists) {
          await log(campaignId, `[${processed}] ${name} | PULANDO (já existe no banco)`);
          await campaignsRepository.updateStats(campaignId, { processed, found });
          continue;
        }

        const { lead, created } = await leadsRepository.createUnique({
          campaign_id: campaignId,
          name,
          ifood_url: ifoodUrl || undefined,
          address: address || undefined,
          zip_code: cleanZipCode,
          city,
          category,
          source: "ifood",
        });

        if (!created || !lead) {
          await log(campaignId, `[${processed}] ${name} | DUPLICADO`);
          await campaignsRepository.updateStats(campaignId, { processed, found });
          continue;
        }

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
