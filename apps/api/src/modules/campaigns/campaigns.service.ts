import * as campaignsRepository from "./campaigns.repository";
import * as prospectingCampaignsRepository from "../prospecting-campaigns/prospecting-campaigns.repository";
import { runDiscovery } from "../../workers/discovery/discovery.worker";
import type { DiscoveryInput, DiscoverySource } from "../../workers/discovery/run";
import { runInstaDeliveryScraping } from "../../workers/instadelivery/instadelivery.worker";
import { runIfoodScraping } from "../../workers/ifood/ifood.worker";
import { cancel } from "../../lib/cancellation";

/**
 * Campanha de prospecção (painel do território) que recebe os leads da captura.
 * Opcional: sem ela os leads vão pro Kanban geral, como sempre foi.
 */
async function resolveDestination(data: Record<string, unknown>): Promise<string | undefined> {
  const id = typeof data.prospectingCampaignId === "string" ? data.prospectingCampaignId.trim() : "";
  if (!id) return undefined;
  if (!(await prospectingCampaignsRepository.findById(id))) throw new Error("Campanha de destino não encontrada.");
  return id;
}

/**
 * Fontes escolhidas na captura. Sem `sources` (clientes antigos, campanhas antigas reiniciadas)
 * vale só o Instagram, como sempre foi: ninguém passa a gastar crédito de outra fonte por surpresa.
 */
function resolveSources(value: unknown): DiscoverySource[] {
  const valid = Array.isArray(value)
    ? value.filter((item): item is DiscoverySource => item === "instagram" || item === "maps")
    : [];
  return valid.length > 0 ? [...new Set(valid)] : ["instagram"];
}

/** Parâmetros da descoberta a partir do corpo da requisição (ou da campanha salva, ao reiniciar). */
function discoveryInput(
  data: Record<string, unknown>,
  prospectingCampaignId?: string,
): DiscoveryInput {
  return {
    category: data.category as string,
    city: data.city as string,
    state: typeof data.state === "string" ? data.state : null,
    quantity: (data.quantity as number) ?? 100,
    sources: resolveSources(data.sources),
    prospectingCampaignId,
  };
}

// ---------------------------------------------------------------------------
// CRUD básico
// ---------------------------------------------------------------------------

export async function createCampaignService(data: Record<string, unknown>) {
  const campaign = await campaignsRepository.create(data);
  return campaign;
}

export async function listCampaignsService() {
  const campaigns = await campaignsRepository.findAll();
  return campaigns;
}

export async function getCampaignService(id: string) {
  const campaign = await campaignsRepository.findById(id);
  if (!campaign) throw new Error("Campanha não encontrada");
  return campaign;
}

// ---------------------------------------------------------------------------
// CRIAR + INICIAR (chamado pelo endpoint POST /campaigns/campaignleadsearch)
// ---------------------------------------------------------------------------

/**
 * Cria a campanha no banco e dispara o worker de discovery em background.
 *
 * O frontend já faz: createCampaign() → startCampaign() em sequência.
 * Aqui unificamos para evitar a janela onde a campanha existe mas o worker
 * ainda não começou.
 */
export async function campaignleadsearchService(data: Record<string, unknown>) {
  const prospectingCampaignId = await resolveDestination(data);
  const campaign = await campaignsRepository.create(data);

  if (!campaign) {
    throw new Error("Falha ao criar campanha no banco de dados");
  }

  // Fire-and-forget: não aguarda — responde ao cliente imediatamente
  runDiscovery(campaign.id, discoveryInput(data, prospectingCampaignId)).catch(async (err) => {
    console.error(`[SERVICE] Worker falhou para campanha ${campaign.id}:`, err);
    await campaignsRepository.updateStatus(campaign.id, "error").catch(() => {});
  });

  return campaign;
}

// ---------------------------------------------------------------------------
// CRIAR + INICIAR INSTAGRAM (chamado pelo endpoint POST /campaigns/campaignleadsearchinsta)
// ---------------------------------------------------------------------------

export async function campaignInstagramSearchService(data: Record<string, unknown>) {
  const prospectingCampaignId = await resolveDestination(data);
  const campaign = await campaignsRepository.create(data);

  if (!campaign) {
    throw new Error("Falha ao criar campanha no banco de dados");
  }

  // Fire-and-forget: não aguarda — responde ao cliente imediatamente
  runDiscovery(campaign.id, discoveryInput(data, prospectingCampaignId)).catch((err) =>
    console.error(`[SERVICE] Worker falhou para campanha ${campaign.id}:`, err),
  );

  return campaign;
}

// ---------------------------------------------------------------------------
// START (chamado pelo endpoint POST /campaigns/:id/start)
// ---------------------------------------------------------------------------

/**
 * Atualiza status para "running" e (re)dispara o worker.
 *
 * Útil para reprocessar campanhas que falharam ou foram pausadas.
 */
// ---------------------------------------------------------------------------
// CRIAR + INICIAR INSTADELIVERY (chamado pelo endpoint POST /campaigns/campaigninstadelivery)
// ---------------------------------------------------------------------------

export async function campaignInstaDeliverySearchService(data: Record<string, unknown>) {
  const prospectingCampaignId = await resolveDestination(data);
  const campaign = await campaignsRepository.create(data);

  if (!campaign) {
    throw new Error("Falha ao criar campanha no banco de dados");
  }

  runInstaDeliveryScraping(
    campaign.id,
    data.city as string,
    (data.quantity as number) ?? 50,
    prospectingCampaignId,
  ).catch(async (err) => {
    console.error(`[SERVICE] InstaDelivery worker falhou para campanha ${campaign.id}:`, err);
    await campaignsRepository.updateStatus(campaign.id, "error").catch(() => {});
  });

  return campaign;
}

// ---------------------------------------------------------------------------
// CRIAR + INICIAR IFOOD (chamado pelo endpoint POST /campaigns/campaignifood)
// ---------------------------------------------------------------------------

export async function campaignIfoodSearchService(data: Record<string, unknown>) {
  const prospectingCampaignId = await resolveDestination(data);
  const campaign = await campaignsRepository.create(data);

  if (!campaign) {
    throw new Error("Falha ao criar campanha no banco de dados");
  }

  runIfoodScraping(
    campaign.id,
    data.city as string,
    data.zipCode as string,
    data.category as string,
    (data.quantity as number) ?? 50,
    prospectingCampaignId,
  ).catch(async (err) => {
    console.error(`[SERVICE] iFood worker falhou para campanha ${campaign.id}:`, err);
    await campaignsRepository.updateStatus(campaign.id, "error").catch(() => {});
  });

  return campaign;
}

// ---------------------------------------------------------------------------
// START (chamado pelo endpoint POST /campaigns/:id/start)
// ---------------------------------------------------------------------------

export async function stopCampaignService(id: string) {
  const campaign = await campaignsRepository.findById(id);
  if (!campaign) throw new Error("Campanha não encontrada");
  if (campaign.status !== "running") return campaign;

  cancel(id);
  return await campaignsRepository.updateStatus(id, "cancelled");
}

export async function startCampaignService(id: string) {
  const campaign = await campaignsRepository.findById(id);
  if (!campaign) throw new Error("Campanha não encontrada");

  const updatedCampaign = await campaignsRepository.updateStatus(id, "running");

  // ✅ Worker agora realmente disparado — não mais comentado
  runDiscovery(id, discoveryInput(campaign as Record<string, unknown>)).catch((err) =>
    console.error(`[SERVICE] Worker falhou ao reiniciar campanha ${id}:`, err),
  );

  return updatedCampaign;
}