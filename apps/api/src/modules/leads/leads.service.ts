import * as leadsRepository from "./leads.repository";

export async function listLeadsService() {
  return await leadsRepository.findAll();
}

export async function listCitiesService() {
  return await leadsRepository.listDistinctCities();
}

export async function getLeadService(id: string) {
  return await leadsRepository.findById(id);
}

export async function updateLeadService(id: string, data: any) {
  return await leadsRepository.update(id, data);
}

export async function deduplicateLeadsService() {
  const leads = await leadsRepository.findAll() as Record<string, unknown>[];
  if (!leads?.length) return { removed: 0 };

  const seen = new Map<string, string>(); // key → id do lead a manter
  const toDelete: string[] = [];

  for (const lead of leads) {
    const id = lead.id as string;

    // Chaves de deduplicação em ordem de prioridade
    const keys: string[] = [];

    const instagram = norm(lead.instagram_url ?? lead.instagram);
    if (instagram) keys.push(`ig:${instagram}`);

    const whatsapp = digits(lead.whatsapp ?? lead.phone);
    if (whatsapp.length >= 8) keys.push(`wa:${whatsapp}`);

    const cnpj = digits(lead.cnpj);
    if (cnpj.length >= 14) keys.push(`cnpj:${cnpj}`);

    const name = norm(lead.name ?? lead.company_name);
    const city = norm(lead.city);
    if (name && city) keys.push(`name:${name}|${city}`);

    let isDup = false;
    for (const key of keys) {
      if (seen.has(key)) {
        isDup = true;
        break;
      }
    }

    if (isDup) {
      toDelete.push(id);
    } else {
      for (const key of keys) seen.set(key, id);
    }
  }

  await leadsRepository.deleteMany(toDelete);
  return { removed: toDelete.length };
}

function norm(v: unknown) {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}
function digits(v: unknown) {
  return typeof v === "string" ? v.replace(/\D/g, "") : "";
}