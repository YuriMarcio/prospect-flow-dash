import axios from "axios";
import { getSupabase } from "../../lib/supabase";
import {
  extractUsernameFromUrl,
  extractWhatsappFromBio,
  extractLinktreeFromBio,
  extractDeliveryLinkFromBio,
} from "./instagram.parser";
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

interface ScrapeCreatorsProfile {
  username?: string;
  full_name?: string;
  biography?: string;
  bio_links?: Array<{ url: string }>;
  external_url?: string | null;
  follower_count?: number;
}

interface LeadRow {
  id: string;
  name: string;
  instagram: string;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function fetchInstagramProfile(handle: string): Promise<ScrapeCreatorsProfile | null> {
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

export async function runInstagramEnrichment(campaignId: string): Promise<void> {
  await log(campaignId, `Iniciando enriquecimento`);

  const supabase = getSupabase();

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, instagram")
    .eq("campaign_id", campaignId)
    .is("whatsapp", null)
    .not("instagram", "is", null);

  if (error) {
    await log(campaignId, `Erro ao buscar leads: ${error.message}`, "error");
    return;
  }

  if (!leads || leads.length === 0) {
    await log(campaignId, `Nenhum lead pendente para enriquecer.`);
    return;
  }

  await log(campaignId, `${leads.length} leads para enriquecer.`);

  for (let i = 0; i < (leads as LeadRow[]).length; i++) {
    const lead = (leads as LeadRow[])[i];
    const username = extractUsernameFromUrl(lead.instagram);

    if (!username) {
      await log(campaignId, `#${i + 1} | ${lead.name} | URL inválida, pulando.`, "warn");
      continue;
    }

    try {
      const profile = await fetchInstagramProfile(username);

      if (!profile) {
        await log(campaignId, `#${i + 1} | ${lead.name} | Perfil não encontrado.`, "warn");
        continue;
      }

      const bio = profile.biography ?? "";
      const bioLinks = profile.bio_links ?? [];
      const extUrl = profile.external_url ?? undefined;

      const whatsapp     = extractWhatsappFromBio(bio, bioLinks, extUrl);
      const linktree     = extractLinktreeFromBio(bio, bioLinks, extUrl);
      const deliveryLink = extractDeliveryLinkFromBio(bio, bioLinks, extUrl);

      await supabase
        .from("leads")
        .update({
          whatsapp,
          linktree,
          delivery_link: deliveryLink,
          biography:     profile.biography   ?? null,
          external_url:  profile.external_url ?? null,
          followers:     profile.follower_count ?? null,
          enriched_at:   new Date().toISOString(),
        })
        .eq("id", lead.id);

      await log(
        campaignId,
        `#${i + 1} | ${lead.name} | WA: ${whatsapp ?? "—"} | Seguidores: ${profile.follower_count ?? "—"}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await log(campaignId, `#${i + 1} | ${lead.name} | Erro: ${msg}`, "error");
    }

    if (i < (leads as LeadRow[]).length - 1) {
      await delay(1200);
    }
  }

  await log(campaignId, `Enriquecimento concluído.`);
}
