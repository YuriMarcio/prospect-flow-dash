import * as leadsRepository from "./leads.repository";

export async function listLeadsService() {
  return await leadsRepository.findAll();
}

export async function getLeadService(id: string) {
  return await leadsRepository.findById(id);
}

export async function updateLeadService(id: string, data: any) {
  return await leadsRepository.update(id, data);
}