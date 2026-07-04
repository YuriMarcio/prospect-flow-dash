import * as campaignsRepository from "./campaigns.repository";
import { runInstagramDiscovery } from "../../workers/instagram/instagram.discovery.worker";
import { runInstaDeliveryScraping } from "../../workers/instadelivery/instadelivery.worker";
import { runIfoodScraping } from "../../workers/ifood/ifood.worker";
import { cancel } from "../../lib/cancellation";

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
  const campaign = await campaignsRepository.create(data);

  if (!campaign) {
    throw new Error("Falha ao criar campanha no banco de dados");
  }

  // Fire-and-forget: não aguarda — responde ao cliente imediatamente
  runInstagramDiscovery(
    campaign.id,
    data.category as string,
    data.city as string,
    (data.quantity as number) ?? 100,
  ).catch(async (err) => {
    console.error(`[SERVICE] Worker falhou para campanha ${campaign.id}:`, err);
    await campaignsRepository.updateStatus(campaign.id, "error").catch(() => {});
  });

  return campaign;
}

// ---------------------------------------------------------------------------
// CRIAR + INICIAR INSTAGRAM (chamado pelo endpoint POST /campaigns/campaignleadsearchinsta)
// ---------------------------------------------------------------------------

export async function campaignInstagramSearchService(data: Record<string, unknown>) {
  const campaign = await campaignsRepository.create(data);

  if (!campaign) {
    throw new Error("Falha ao criar campanha no banco de dados");
  }

  // Fire-and-forget: não aguarda — responde ao cliente imediatamente
  runInstagramDiscovery(
    campaign.id,
    data.category as string,
    data.city as string,
    (data.quantity as number) ?? 100,
  ).catch((err) =>
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
  const campaign = await campaignsRepository.create(data);

  if (!campaign) {
    throw new Error("Falha ao criar campanha no banco de dados");
  }

  runInstaDeliveryScraping(
    campaign.id,
    data.city as string,
    (data.quantity as number) ?? 50,
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
  runInstagramDiscovery(
    id,
    campaign.category as string,
    campaign.city as string,
    (campaign.quantity as number) ?? 100,
  ).catch((err) =>
    console.error(`[SERVICE] Worker falhou ao reiniciar campanha ${id}:`, err),
  );

  return updatedCampaign;
}