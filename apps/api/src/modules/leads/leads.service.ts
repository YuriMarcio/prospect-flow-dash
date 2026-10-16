import * as leadsRepository from "./leads.repository";
import * as campaignsRepository from "../prospecting-campaigns/prospecting-campaigns.repository";
import * as queueRepository from "../prospector/queue.repository";
import * as planRepository from "../prospector/plan.repository";
import * as leadFlowStateRepository from "../prospector/lead-flow-state.repository";
import { normalizeToE164 } from "../../lib/phone";
import { toInstagramUrl } from "../../lib/instagram";
import { createLeadSchema } from "./leads.schemas";

/** Erro "esperado" (entrada inválida, duplicado): o controller devolve a mensagem com o status. */
export class LeadError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export async function listLeadsService() {
  return await leadsRepository.findAll();
}

export async function listCitiesService() {
  return await leadsRepository.listDistinctCities();
}

export async function getLeadService(id: string) {
  return await leadsRepository.findById(id);
}

/** WhatsApp digitado → E.164, ou erro claro. Vazio vira null (campo limpo). */
function parseWhatsapp(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const normalized = normalizeToE164(raw);
  if (!normalized) throw new LeadError(400, "WhatsApp inválido. Use DDD + número, ex.: (21) 99999-0000.");
  return normalized;
}

function parseInstagram(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const url = toInstagramUrl(raw);
  if (!url) throw new LeadError(400, "Instagram inválido. Use @perfil ou o link do perfil.");
  return url;
}

export async function updateLeadService(id: string, data: Record<string, unknown>) {
  const patch = { ...data };

  // Só normaliza/valida o que é dado de contato; o resto (status, coluna, reunião...) passa como sempre.
  if ("whatsapp" in patch) patch.whatsapp = parseWhatsapp(patch.whatsapp as string | null);
  if ("instagram" in patch) patch.instagram = parseInstagram(patch.instagram as string | null);
  if ("name" in patch && !String(patch.name ?? "").trim()) throw new LeadError(400, "O nome do lead não pode ficar vazio.");

  // Lead que sai de "A Prospectar" à mão (falei com ele pelo WhatsApp, arrastei no Kanban...) não pode
  // receber a abertura do bot por cima: só "novo" entra na fila, então cancela o que ainda estava pendente.
  if (typeof patch.status === "string" && patch.status !== "novo") {
    const current = await leadsRepository.findById(id);
    if (current?.status === "novo" && current.prospecting_campaign_id) {
      const campaignId = current.prospecting_campaign_id as string;
      await queueRepository.removeWaitingForLead(id, campaignId);
      await planRepository.unassign(id);
      await leadFlowStateRepository.stopForLead(id, campaignId);
    }
  }

  return await leadsRepository.update(id, patch);
}

/**
 * Cadastra um lead à mão. Vai pro Kanban geral (coluna "A Prospectar") ou, com
 * `prospectingCampaignId`, direto pro painel daquela campanha.
 *
 * Se já existe um lead igual (mesmo WhatsApp, Instagram etc.): quando ele está
 * solto e há campanha de destino, é ADOTADO por ela; senão a mensagem diz onde ele está.
 */
export async function createLeadService(raw: unknown): Promise<{ lead: Record<string, unknown>; adopted: boolean }> {
  const parsed = createLeadSchema.safeParse(raw);
  if (!parsed.success) throw new LeadError(400, parsed.error.issues[0]?.message ?? "Dados do lead inválidos.");
  const input = parsed.data;

  const campaignId = input.prospectingCampaignId ?? null;
  if (campaignId && !(await campaignsRepository.findById(campaignId))) {
    throw new LeadError(404, "Campanha não encontrada.");
  }

  const payload: Record<string, unknown> = {
    name: input.name,
    whatsapp: parseWhatsapp(input.whatsapp),
    instagram: parseInstagram(input.instagram),
    city: input.city?.trim() || null,
    category: input.category?.trim() || null,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
    source: "manual",
    status: input.status ?? "novo",
    column_id: input.columnId ?? "col-1",
    prospecting_campaign_id: campaignId,
  };

  const result = await leadsRepository.createUnique(payload);
  if (result.created) return { lead: result.lead, adopted: false };

  const existing = result.lead;
  if (campaignId && existing.prospecting_campaign_id === campaignId) {
    throw new LeadError(409, `"${existing.name ?? input.name}" já está nesta campanha.`);
  }
  if (campaignId && !existing.prospecting_campaign_id && (await leadsRepository.claimForCampaign(existing.id, campaignId))) {
    return { lead: (await leadsRepository.findById(existing.id)) as Record<string, unknown>, adopted: true };
  }
  if (existing.prospecting_campaign_id) {
    const other = await campaignsRepository.findById(existing.prospecting_campaign_id);
    throw new LeadError(409, `Já existe um lead igual ("${existing.name ?? "sem nome"}") na campanha "${other?.name ?? "outra"}".`);
  }
  throw new LeadError(409, `Já existe um lead igual: "${existing.name ?? "sem nome"}".`);
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