import axios from "axios";
import { getSupabase } from "../../lib/supabase";
import { extractUsernameFromUrl } from "./instagram.parser";
import { profileToLeadFields, providerRejection, type ScrapeCreatorsProfile } from "./instagram.profile";
import * as logsRepository from "../../modules/logs/logs.repository";

async function log(
  campaignId: string,
  message: string,
  level: "info" | "warn" | "error" = "info",
) {
  console.log(`[ENRICHMENT] ${message}`);
  try {
    await logsRepository.create(campaignId, `[ENRICHMENT] ${message}`, level);
  } catch {
    // não deixa falha de log derrubar o worker
  }
}

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------
interface LeadRow {
  id: string;
  name: string;
  instagram: string;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function fetchInstagramProfile(handle: string): Promise<ScrapeCreatorsProfile | null> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;
  if (!apiKey) throw new Error("[ENRICHMENT] SCRAPECREATORS_API_KEY não configurada no .env");

  const { data } = await axios.get<ScrapeCreatorsProfile>(
    "https://api.scrapecreators.com/v1/instagram/profile",
    {
      params: { handle },
      headers: { "x-api-key": apiKey },
      timeout: 15_000,
    },
  );

  return data ?? null;
}

// ---------------------------------------------------------------------------
// WORKER PRINCIPAL
// ---------------------------------------------------------------------------

export interface EnrichmentOptions {
  /** Teto de consultas ao ScrapeCreators nesta passada (orçamento da campanha). */
  maxCalls?: number;
}

/** Devolve quantas consultas ao ScrapeCreators foram feitas. */
export async function runInstagramEnrichment(
  campaignId: string,
  options: EnrichmentOptions = {},
): Promise<number> {
  await log(campaignId, `Iniciando enriquecimento`);

  const supabase = getSupabase();

  const pending = (skipEnriched: boolean) => {
    const query = supabase
      .from("leads")
      .select("id, name, instagram")
      .eq("campaign_id", campaignId)
      .is("whatsapp", null)
      .not("instagram", "is", null);
    return skipEnriched ? query.is("enriched_at", null) : query;
  };

  // Leads já enriquecidos (inclusive os validados na descoberta) não gastam outra consulta.
  let { data: leads, error } = await pending(true);
  if (error && /enriched_at/.test(error.message)) ({ data: leads, error } = await pending(false));

  if (error) {
    await log(campaignId, `Erro ao buscar leads: ${error.message}`, "error");
    return 0;
  }

  if (!leads || leads.length === 0) {
    await log(campaignId, `Nenhum lead pendente para enriquecer.`);
    return 0;
  }

  const queue = (leads as LeadRow[]).slice(0, options.maxCalls ?? Infinity);
  if (queue.length < leads.length) {
    await log(campaignId, `Orçamento de enriquecimento: ${queue.length} de ${leads.length} leads.`, "warn");
  }
  await log(campaignId, `${queue.length} leads para enriquecer.`);

  let calls = 0;
  for (let i = 0; i < queue.length; i++) {
    const lead = queue[i];
    const username = extractUsernameFromUrl(lead.instagram);

    if (!username) {
      await log(campaignId, `#${i + 1} | ${lead.name} | URL inválida, pulando.`, "warn");
      continue;
    }

    try {
      calls++;
      const profile = await fetchInstagramProfile(username);

      if (!profile) {
        await log(campaignId, `#${i + 1} | ${lead.name} | Perfil não encontrado.`, "warn");
        continue;
      }

      const fields = profileToLeadFields(profile);
      await supabase.from("leads").update(fields).eq("id", lead.id);

      await log(
        campaignId,
        `#${i + 1} | ${lead.name} | WA: ${fields.whatsapp ?? "—"} | Seguidores: ${profile.follower_count ?? "—"}`,
      );
    } catch (err: unknown) {
      const rejected = providerRejection(err);
      if (rejected) {
        await log(
          campaignId,
          `ScrapeCreators recusou a consulta (HTTP ${rejected}): créditos esgotados ou chave inválida. Enriquecimento interrompido.`,
          "error",
        );
        break;
      }
      const msg = err instanceof Error ? err.message : String(err);
      await log(campaignId, `#${i + 1} | ${lead.name} | Erro: ${msg}`, "error");
    }

    if (i < queue.length - 1) {
      await delay(1200);
    }
  }

  await log(campaignId, `Enriquecimento concluído.`);
  return calls;
}
