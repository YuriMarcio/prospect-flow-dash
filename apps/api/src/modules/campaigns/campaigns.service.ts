import * as campaignsRepository from "./campaigns.repository";
// No futuro, importaremos o worker aqui:
// import { startIfoodWorker } from "../../workers/ifood/ifood.worker";

export async function createCampaignService(data: any) {
  // 1. Salva a campanha
  const campaign = await campaignsRepository.create(data);
  return campaign;
}

export async function listCampaignsService() {
  // 1. Busca todas as campanhas
  const campaigns = await campaignsRepository.findAll();
  return campaigns;
}

export async function getCampaignService(id: string) {
  // 1. Busca uma campanha específica
  const campaign = await campaignsRepository.findById(id);
  
  if (!campaign) {
    throw new Error("Campanha não encontrada");
  }
  
  return campaign;
}

export async function startCampaignService(id: string) {
  // 1. Verifica se a campanha existe
  const campaign = await campaignsRepository.findById(id);
  if (!campaign) {
    throw new Error("Campanha não encontrada");
  }

  // 2. Atualiza o status para 'running'
  const updatedCampaign = await campaignsRepository.updateStatus(id, "running");

  // 3. Dispara o Worker em background (Fire and forget)
  // startIfoodWorker(id).catch(console.error);
  console.log(`[WORKER] Iniciando scraping para campanha ${id}...`);

  return updatedCampaign;
}