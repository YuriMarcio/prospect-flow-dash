import * as campaignsRepository from "./campaigns.repository";
import * as prospectingCampaignsRepository from "../prospecting-campaigns/prospecting-campaigns.repository";
import { runDiscovery } from "../../workers/discovery/discovery.worker";
import type { DiscoveryInput, DiscoverySource } from "../../workers/discovery/run";
import { MAX_SEGMENTS, resolveSegments } from "../../workers/discovery/segments";
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

/**
 * Valida os segmentos e monta a linha da campanha. `quantity` do formulário é POR SEGMENTO; a
 * campanha guarda o total (é o denominador da barra de progresso) e `category` fica como o
 * resumo legível ("Hamburgueria, Pizzaria"), que também funciona como busca se `categories`
 * não existir no banco (vira alternativas da mesma busca).
 */
function planCapture(data: Record<string, unknown>) {
  const segments = resolveSegments(data);
  if (segments.length === 0) throw new Error("Informe ao menos um segmento.");
  if (segments.length > MAX_SEGMENTS) throw new Error(`Escolha no máximo ${MAX_SEGMENTS} segmentos por captura.`);

  const perSegment = (data.quantity as number) ?? 100;
  return {
    segments,
    perSegment,
    row: { ...data, category: segments.join(", "), categories: segments, quantity: perSegment * segments.length },
  };
}

/** Parâmetros da descoberta: do corpo da requisição ou, ao reiniciar, da campanha salva. */
function discoveryInput(
  data: Record<string, unknown>,
  segments: string[],
  perSegment: number,
  prospectingCampaignId?: string,
): DiscoveryInput {
  return {
    category: segments[0],
    categories: segments,
    city: data.city as string,
    state: typeof data.state === "string" ? data.state : null,
    quantity: perSegment,
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
  const plan = planCapture(data);
  const prospectingCampaignId = await resolveDestination(data);
  const campaign = await campaignsRepository.create(plan.row);

  if (!campaign) {
    throw new Error("Falha ao criar campanha no banco de dados");
  }

  // Fire-and-forget: não aguarda — responde ao cliente imediatamente
  runDiscovery(campaign.id, discoveryInput(data, plan.segments, plan.perSegment, prospectingCampaignId)).catch(async (err) => {
    console.error(`[SERVICE] Worker falhou para campanha ${campaign.id}:`, err);
    await campaignsRepository.updateStatus(campaign.id, "error").catch(() => {});
  });

  return campaign;
}

// ---------------------------------------------------------------------------
// CRIAR + INICIAR INSTAGRAM (chamado pelo endpoint POST /campaigns/campaignleadsearchinsta)
// ---------------------------------------------------------------------------

export async function campaignInstagramSearchService(data: Record<string, unknown>) {
  const plan = planCapture(data);
  const prospectingCampaignId = await resolveDestination(data);
  const campaign = await campaignsRepository.create(plan.row);

  if (!campaign) {
    throw new Error("Falha ao criar campanha no banco de dados");
  }

  // Fire-and-forget: não aguarda — responde ao cliente imediatamente
  runDiscovery(campaign.id, discoveryInput(data, plan.segments, plan.perSegment, prospectingCampaignId)).catch((err) =>
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
  const row = campaign as Record<string, unknown>;
  const segments = resolveSegments(row);
  // A campanha guarda o total; a meta é por segmento.
  const perSegment = Math.ceil(((row.quantity as number) ?? 100) / Math.max(1, segments.length));

  runDiscovery(id, discoveryInput(row, segments, perSegment)).catch((err) =>
    console.error(`[SERVICE] Worker falhou ao reiniciar campanha ${id}:`, err),
  );

  return updatedCampaign;
}