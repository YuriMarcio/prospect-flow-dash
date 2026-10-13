import type { CreateUniqueResult, DuplicateLead } from "../../modules/leads/leads.repository";
import type { ScrapeCreatorsProfile } from "../instagram/instagram.profile";
import type { Budget } from "./budget";
import type { QueuedCandidate, SaveQueuedResult } from "./candidates.repository";
import { nationalDigits } from "../../lib/phone";
import { handleAsName, sameBusiness } from "./business-name";
import type { DiscoveryLimits } from "./discovery.config";
import type { SerpClient } from "./serp.client";

export type LogLevel = "info" | "warn" | "error";
export type DiscoverySource = "instagram" | "maps";
export type CompletionReason = "goal_reached" | "sources_exhausted" | "budget_exhausted" | "source_errors";
/** merged = o negócio já tinha sido salvo por outra fonte nesta corrida; só completou os campos que faltavam. */
export type SaveOutcome = "created" | "adopted" | "duplicate" | "merged";

export interface CampaignStatsPatch {
  status?: string;
  processed?: number;
  found?: number;
  error_count?: number;
  completion_reason?: CompletionReason;
}

/** Tudo que o orquestrador usa do mundo externo, injetável para testar sem créditos nem banco. */
export interface DiscoveryDeps {
  serp: SerpClient;
  limits: DiscoveryLimits;
  leads: {
    createUnique(data: Record<string, unknown>): Promise<CreateUniqueResult>;
    adoptDuplicate(duplicate: DuplicateLead, campaignId: string): Promise<"adopted" | "already" | "other">;
    findByInstagram(instagramUrl: string): Promise<DuplicateLead | null>;
    update(id: string, data: Record<string, unknown>): Promise<unknown>;
  };
  campaigns: { updateStats(id: string, patch: CampaignStatsPatch): Promise<void> };
  profiles: { fetch(handle: string): Promise<ScrapeCreatorsProfile | null> };
  candidates: { save(rows: QueuedCandidate[]): Promise<SaveQueuedResult> };
  enrich(campaignId: string, options: { maxCalls: number }): Promise<number>;
  log(campaignId: string, message: string, level?: LogLevel): Promise<void>;
  isCancelled(campaignId: string): boolean;
  cleanup(campaignId: string): void;
  delay(ms: number): Promise<void>;
}

export interface DiscoveryInput {
  /** Segmento único (clientes antigos). Com `categories`, vale a lista. */
  category: string;
  /** Segmentos da captura: cada um roda a descoberta completa, com `quantity` e orçamento próprios. */
  categories?: string[];
  city: string;
  state?: string | null;
  /** Meta de leads POR SEGMENTO. */
  quantity: number;
  sources: DiscoverySource[];
  /** Painel (campanha de prospecção) que recebe os leads; sem ele vão para o Kanban geral. */
  prospectingCampaignId?: string;
}

export interface RunContext {
  campaignId: string;
  /** Segmento desta corrida: é a categoria gravada nos leads que ela cria. */
  category: string;
  city: string;
  /** UF já normalizada (ex.: "MA") ou null. */
  state: string | null;
  quantity: number;
  prospectingCampaignId?: string;
  /** Leads já somados pelos segmentos anteriores: o progresso da campanha é o total de todos. */
  foundBefore: number;
  /** Prefixo das linhas de log quando a captura tem mais de um segmento. */
  logPrefix: string;
  /** Fontes escolhidas nesta captura: uma fonte divide o orçamento de buscas com as outras. */
  sources: DiscoverySource[];
  deps: DiscoveryDeps;
  budget: Budget;
}

/** O que identifica o negócio, para reconhecer o mesmo estabelecimento vindo de outra fonte. */
export interface LeadIdentity {
  name: string;
  /** @ do Instagram, sem arroba, minúsculo. */
  handle?: string | null;
  /** Telefone em qualquer formato. */
  phone?: string | null;
  placeId?: string | null;
}

export interface LeadDraft {
  source: DiscoverySource;
  identity: LeadIdentity;
  fields: Record<string, unknown>;
}

interface RegisteredLead {
  id: string;
  source: DiscoverySource;
  identity: LeadIdentity;
  fields: Record<string, unknown>;
}

export interface DiscoveryMetrics {
  /** Resultados devolvidos pelas buscas, antes de qualquer filtro. */
  raw: number;
  approved: number;
  /** Pendentes cuja bio confirmou a cidade. */
  validated: number;
  queued: number;
  rejected: number;
  duplicates: number;
  created: number;
  /** Mesmo negócio visto por duas fontes e consolidado num lead só. */
  merged: number;
}

/**
 * Estado compartilhado de uma corrida de descoberta. As fontes (Instagram, Maps) só
 * classificam e entregam candidatos; contagem da meta, deduplicação, fila técnica e
 * estatísticas ficam aqui, em um lugar só.
 */
export class DiscoveryRun {
  /** Leads válidos e únicos (criados ou adotados pela campanha de destino). Só isso conta para a meta. */
  found = 0;
  /** Alguma fonte parou por limite (páginas/orçamento) e não por falta de resultado. */
  limited = false;
  /** Buscas/consultas que falharam: a cobertura ficou incompleta, então não dá para dizer "fontes esgotadas". */
  errors = 0;
  /** O ScrapeCreators recusou chave/créditos: nesta corrida não se consulta mais bio. */
  providerBlocked = false;
  readonly metrics: DiscoveryMetrics = { raw: 0, approved: 0, validated: 0, queued: 0, rejected: 0, duplicates: 0, created: 0, merged: 0 };
  readonly queued: QueuedCandidate[] = [];

  constructor(readonly ctx: RunContext) {}

  get goalReached(): boolean {
    return this.found >= this.ctx.quantity;
  }

  get cancelled(): boolean {
    return this.ctx.deps.isCancelled(this.ctx.campaignId);
  }

  log(message: string, level: LogLevel = "info"): Promise<void> {
    return this.ctx.deps.log(this.ctx.campaignId, `${this.ctx.logPrefix}${message}`, level);
  }

  private readonly registered: RegisteredLead[] = [];

  /**
   * Este negócio já foi salvo nesta corrida por outra fonte? Se sim, a cidade dele já foi
   * confirmada lá (ex.: pelo endereço do Maps) e não vale gastar consulta de bio para confirmar.
   */
  knowsEstablishment(identity: LeadIdentity, source: DiscoverySource): boolean {
    return this.findRegistered(identity, source) !== undefined;
  }

  /** Lead desta corrida que é o mesmo negócio: mesmo @, mesmo place_id, mesmo telefone ou nome equivalente. */
  private findRegistered(identity: LeadIdentity, source: DiscoverySource): RegisteredLead | undefined {
    const phone = identity.phone ? nationalDigits(identity.phone) : "";

    return this.registered.find((entry) => {
      const known = entry.identity;
      if (identity.handle && known.handle === identity.handle) return true;
      if (identity.placeId && known.placeId === identity.placeId) return true;
      if (phone && known.phone && nationalDigits(known.phone) === phone) return true;

      // Nome parecido só junta fontes diferentes (Maps × Instagram): dois perfis do Instagram
      // com nomes semelhantes podem ser negócios distintos.
      if (entry.source === source) return false;
      const knownName = known.handle ? `${known.name} ${handleAsName(known.handle)}` : known.name;
      const ownName = identity.handle ? `${identity.name} ${handleAsName(identity.handle)}` : identity.name;
      return (
        sameBusiness(identity.name, known.name, this.ctx.city) ||
        sameBusiness(ownName, knownName, this.ctx.city)
      );
    });
  }

  /**
   * Cria o lead. Se outra fonte já salvou este mesmo negócio nesta corrida, completa o lead
   * existente (só campos vazios) em vez de criar um segundo. Se já existe no banco, tenta
   * adotá-lo na campanha de destino. Só criado/adotado conta para a meta.
   */
  async saveLead(draft: LeadDraft): Promise<SaveOutcome> {
    const { deps, campaignId, category, city, prospectingCampaignId } = this.ctx;

    const sibling = this.findRegistered(draft.identity, draft.source);
    if (sibling) {
      await this.mergeInto(sibling, draft);
      return "merged";
    }

    const saved = await deps.leads.createUnique({
      campaign_id: campaignId,
      category,
      city,
      source: draft.source,
      ...(prospectingCampaignId ? { prospecting_campaign_id: prospectingCampaignId } : {}),
      ...draft.fields,
    });

    let outcome: SaveOutcome = saved.created ? "created" : "duplicate";
    if (!saved.created && prospectingCampaignId) {
      const adopted = await deps.leads.adoptDuplicate(saved.lead, prospectingCampaignId);
      if (adopted === "adopted") outcome = "adopted";
    }

    if (outcome !== "duplicate") {
      this.registered.push({
        id: saved.lead.id as string,
        source: draft.source,
        identity: draft.identity,
        fields: { ...draft.fields },
      });
    }

    await this.countOutcome(outcome);
    return outcome;
  }

  private async mergeInto(entry: RegisteredLead, draft: LeadDraft): Promise<void> {
    const missing = Object.fromEntries(
      Object.entries(draft.fields).filter(
        ([key, value]) => value !== null && value !== undefined && (entry.fields[key] === null || entry.fields[key] === undefined),
      ),
    );

    if (Object.keys(missing).length > 0) {
      await this.ctx.deps.leads.update(entry.id, missing);
      Object.assign(entry.fields, missing);
    }
    entry.identity = {
      ...entry.identity,
      handle: entry.identity.handle ?? draft.identity.handle,
      phone: entry.identity.phone ?? draft.identity.phone,
      placeId: entry.identity.placeId ?? draft.identity.placeId,
    };
    this.metrics.merged++;
  }

  /** Lead que já existe no banco, achado antes de gastar crédito: adota se der, senão só pula. */
  async adoptExisting(existing: DuplicateLead): Promise<SaveOutcome> {
    const { deps, prospectingCampaignId } = this.ctx;
    const adopted = prospectingCampaignId
      ? (await deps.leads.adoptDuplicate(existing, prospectingCampaignId)) === "adopted"
      : false;

    const outcome: SaveOutcome = adopted ? "adopted" : "duplicate";
    await this.countOutcome(outcome);
    return outcome;
  }

  private async countOutcome(outcome: SaveOutcome): Promise<void> {
    if (outcome === "duplicate") {
      this.metrics.duplicates++;
      return;
    }
    if (outcome === "created") this.metrics.created++;
    this.found++;
    await this.syncStats();
  }

  queue(candidate: Omit<QueuedCandidate, "campaign_id">): void {
    this.metrics.queued++;
    this.queued.push({ campaign_id: this.ctx.campaignId, ...candidate });
  }

  async syncStats(): Promise<void> {
    // `processed` acompanha `found`: a barra de progresso da tela mede a meta de leads válidos.
    const total = this.ctx.foundBefore + this.found;
    await this.ctx.deps.campaigns.updateStats(this.ctx.campaignId, { processed: total, found: total });
  }
}
