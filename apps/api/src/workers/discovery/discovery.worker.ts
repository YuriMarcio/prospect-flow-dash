import { runInstagramSource } from "../instagram/instagram.source";
import { runMapsSource } from "./maps.source";
import { Budget } from "./budget";
import { createDefaultDeps } from "./discovery.deps";
import { normalizeUf } from "./location";
import {
  DiscoveryRun,
  type CompletionReason,
  type DiscoveryDeps,
  type DiscoveryInput,
  type DiscoverySource,
} from "./run";

const REASON_TEXT: Record<CompletionReason, string> = {
  goal_reached: "meta atingida",
  sources_exhausted: "fontes esgotadas",
  budget_exhausted: "limite de buscas/orçamento atingido",
};

/**
 * Descoberta de leads por várias fontes. O objetivo não é achar N perfis, e sim até N
 * estabelecimentos reais da categoria e cidade pedidas, gastando o mínimo por lead válido:
 * cada fonte classifica o que encontra, a meta conta só leads válidos e únicos, e as buscas
 * param quando deixam de render ou quando o orçamento da campanha acaba.
 */
export async function runDiscovery(
  campaignId: string,
  input: DiscoveryInput,
  deps: DiscoveryDeps = createDefaultDeps(),
): Promise<void> {
  const state = normalizeUf(input.state);
  const sources: DiscoverySource[] = input.sources?.length ? input.sources : ["instagram"];
  const { limits } = deps;

  const budget = new Budget({
    search: limits.maxSearchRequests,
    lookup: limits.maxLookupRequests,
    enrich: limits.maxEnrichCalls,
  });

  const run = new DiscoveryRun({
    campaignId,
    category: input.category,
    city: input.city,
    state,
    quantity: input.quantity,
    prospectingCampaignId: input.prospectingCampaignId,
    sources,
    deps,
    budget,
  });

  await deps.campaigns.updateStats(campaignId, { status: "running", processed: 0, found: 0 });
  await run.log(
    `Iniciando descoberta: "${input.category}" em "${input.city}${state ? `/${state}` : ""}" | meta: ${input.quantity} leads | fontes: ${sources.join(", ")}`,
  );

  try {
    // Maps primeiro: ele acha os estabelecimentos; o Instagram completa canais e acha o que faltou.
    if (sources.includes("maps")) await runMapsSource(run);
    if (sources.includes("instagram")) await runInstagramSource(run);
  } finally {
    await persistQueue(run);
  }

  const wasCancelled = run.cancelled;
  deps.cleanup(campaignId);

  if (wasCancelled) {
    await run.log(`Captura interrompida. ${run.found} leads salvos até o momento.`, "warn");
    return;
  }

  const reason: CompletionReason = run.goalReached ? "goal_reached" : run.limited ? "budget_exhausted" : "sources_exhausted";
  await run.log(`Concluído: ${run.found} de ${input.quantity} leads (${REASON_TEXT[reason]}).`);
  await deps.campaigns.updateStats(campaignId, {
    status: "done",
    processed: run.found,
    found: run.found,
    completion_reason: reason,
  });

  // Enriquece (bio) os leads salvos sem WhatsApp, dentro do que sobrou do orçamento de consultas.
  if (budget.remaining("enrich") > 0) {
    const used = await deps.enrich(campaignId, { maxCalls: budget.remaining("enrich") });
    for (let i = 0; i < used; i++) budget.spend("enrich");
  } else {
    await run.log("Sem orçamento de consultas de bio para enriquecer os leads salvos.", "warn");
  }

  await run.log(summarize(run, budget));
}

async function persistQueue(run: DiscoveryRun): Promise<void> {
  if (run.queued.length === 0) return;

  const result = await run.ctx.deps.candidates.save(run.queued);
  await run.log(
    result.persisted
      ? `${run.queued.length} candidato(s) na fila técnica (fora do Kanban).`
      : `${run.queued.length} candidato(s) iriam para a fila técnica, mas ela não foi gravada (${result.error ?? "erro desconhecido"}). Aplique a migration discovery_candidates.`,
    result.persisted ? "info" : "warn",
  );
}

function summarize(run: DiscoveryRun, budget: Budget): string {
  const { metrics } = run;
  const credits = budget.totalUsed();
  const perLead = run.found > 0 ? (credits / run.found).toFixed(1) : "—";

  return [
    `Resumo:`,
    `buscas ${budget.usedOf("search")}/${run.ctx.deps.limits.maxSearchRequests}`,
    `bios ${budget.usedOf("enrich")}/${run.ctx.deps.limits.maxEnrichCalls}`,
    `resultados brutos ${metrics.raw}`,
    `aprovados ${metrics.approved}`,
    `validados na bio ${metrics.validated}`,
    `fila técnica ${metrics.queued}`,
    `rejeitados ${metrics.rejected}`,
    `repetidos ${metrics.duplicates}`,
    `consolidados entre fontes ${metrics.merged}`,
    `buscas de Instagram por nome ${budget.usedOf("lookup")}/${run.ctx.deps.limits.maxLookupRequests}`,
    `leads novos ${run.found}`,
    `créditos/lead ${perLead}`,
  ].join(" | ");
}
