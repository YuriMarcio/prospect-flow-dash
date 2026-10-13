import * as leadsRepository from "../../modules/leads/leads.repository";
import * as logsRepository from "../../modules/logs/logs.repository";
import * as campaignsRepository from "../../modules/campaigns/campaigns.repository";
import { cleanup, isCancelled } from "../../lib/cancellation";
import { fetchInstagramProfile, runInstagramEnrichment } from "../instagram/instagram.enrichment.worker";
import { saveQueued } from "./candidates.repository";
import { loadLimits } from "./discovery.config";
import type { DiscoveryDeps } from "./run";
import { createSerpClient } from "./serp.client";

/** Dependências reais: SerpAPI, ScrapeCreators e o banco. Falha cedo se a chave da SerpAPI não existir. */
export function createDefaultDeps(): DiscoveryDeps {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) throw new Error("[DISCOVERY] SERP_API_KEY não configurada no .env");

  return {
    serp: createSerpClient(apiKey),
    limits: loadLimits(),
    leads: {
      createUnique: leadsRepository.createUnique,
      adoptDuplicate: leadsRepository.adoptDuplicate,
      findByInstagram: leadsRepository.findByInstagram,
      update: leadsRepository.update,
    },
    campaigns: { updateStats: campaignsRepository.updateStats },
    profiles: { fetch: fetchInstagramProfile },
    candidates: { save: saveQueued },
    enrich: (campaignId, options) => runInstagramEnrichment(campaignId, options),
    async log(campaignId, message, level = "info") {
      console.log(`[DISCOVERY] ${message}`);
      try {
        await logsRepository.create(campaignId, message, level);
      } catch {
        // não deixa falha de log derrubar o worker
      }
    },
    isCancelled,
    cleanup,
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}
