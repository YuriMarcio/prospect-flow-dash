import { runInstagramSource } from "../instagram/instagram.source";
import { Budget } from "./budget";
import { createDefaultDeps } from "./discovery.deps";
import { normalizeUf } from "./location";
import { runMapsSource } from "./maps.source";
import {
  DiscoveryRun,
  type CompletionReason,
  type DiscoveryDeps,
  type DiscoveryInput,
  type DiscoverySource,
} from "./run";
import { resolveSegments } from "./segments";

const REASON_TEXT: Record<CompletionReason, string> = {
  goal_reached: "meta atingida",
  sources_exhausted: "fontes esgotadas",
  budget_exhausted: "limite de buscas/orçamento atingido",
};

interface SegmentOutcome {
  run: DiscoveryRun;
  budget: Budget;
}

/**
 * Descoberta de leads por várias fontes e vários segmentos. O objetivo não é achar N perfis, e
 * sim até N estabelecimentos reais da categoria e cidade pedidas, gastando o mínimo por lead
 * válido: cada fonte classifica o que encontra, a meta conta só leads válidos e únicos, e as
 * buscas param quando deixam de render ou quando o orçamento acaba.
 *
 * Cada segmento roda a descoberta completa em sequência, com meta e orçamento próprios, e grava
 * os leads com a categoria do segmento em que foram achados. O progresso da campanha é a soma.
 */
export async function runDiscovery(
  campaignId: string,
  input: DiscoveryInput,
  deps: DiscoveryDeps = createDefaultDeps(),
): Promise<void> {
  const segments = resolveSegments(input);
  if (segments.length === 0) throw new Error("[DISCOVERY] Nenhum segmento informado.");

  const state = normalizeUf(input.state);
  const sources: DiscoverySource[] = input.sources?.length ? input.sources : ["instagram"];
  const multi = segments.length > 1;

  await deps.campaigns.updateStats(campaignId, { status: "running", processed: 0, found: 0 });
  await deps.log(
    campaignId,
    `Iniciando descoberta: ${segments.map((segment) => `"${segment}"`).join(", ")} em "${input.city}${state ? `/${state}` : ""}" | meta: ${input.quantity} leads${multi ? " por segmento" : ""} | fontes: ${sources.join(", ")}`,
  );

  const outcomes: SegmentOutcome[] = [];
  let foundTotal = 0;

  for (const [index, category] of segments.entries()) {
    if (deps.isCancelled(campaignId)) break;
    if (multi) await deps.log(campaignId, `Segmento ${index + 1}/${segments.length}: "${category}"`);

    const outcome = await runSegment(campaignId, category, input, state, sources, deps, foundTotal, multi);
    outcomes.push(outcome);
    foundTotal += outcome.run.found;
  }

  const wasCancelled = deps.isCancelled(campaignId);
  deps.cleanup(campaignId);

  if (wasCancelled) {
    await deps.log(campaignId, `Captura interrompida. ${foundTotal} leads salvos até o momento.`, "warn");
    return;
  }

  const reason = completionReason(outcomes);
  const target = input.quantity * segments.length;
  await deps.log(campaignId, `Concluído: ${foundTotal} de ${target} leads (${REASON_TEXT[reason]}).`);
  await deps.campaigns.updateStats(campaignId, {
    status: "done",
    processed: foundTotal,
    found: foundTotal,
    completion_reason: reason,
  });

  await enrichLeftovers(campaignId, outcomes, deps);

  for (const { run, budget } of outcomes) {
    await run.log(summarize(run, budget));
  }
}

async function runSegment(
  campaignId: string,
  category: string,
  input: DiscoveryInput,
  state: string | null,
  sources: DiscoverySource[],
  deps: DiscoveryDeps,
  foundBefore: number,
  multi: boolean,
): Promise<SegmentOutcome> {
  const { limits } = deps;

  // Orçamento por segmento: cada segmento é uma descoberta completa.
  const budget = new Budget({
    search: limits.maxSearchRequests,
    lookup: limits.maxLookupRequests,
    enrich: limits.maxEnrichCalls,
  });

  const run = new DiscoveryRun({
    campaignId,
    category,
    city: input.city,
    state,
    quantity: input.quantity,
    prospectingCampaignId: input.prospectingCampaignId,
    foundBefore,
    logPrefix: multi ? `[${category}] ` : "",
    sources,
    deps,
    budget,
  });

  try {
    // Maps primeiro: ele acha os estabelecimentos; o Instagram completa canais e acha o que faltou.
    if (sources.includes("maps")) await runMapsSource(run);
    if (sources.includes("instagram")) await runInstagramSource(run);
  } finally {
    await persistQueue(run);
  }

  return { run, budget };
}

/** Meta atingida em todos os segmentos; senão, limite se algum parou por ele; senão, fontes esgotadas. */
function completionReason(outcomes: SegmentOutcome[]): CompletionReason {
  if (outcomes.every(({ run }) => run.goalReached)) return "goal_reached";
  if (outcomes.some(({ run }) => !run.goalReached && run.limited)) return "budget_exhausted";
  return "sources_exhausted";
}

/** Consulta a bio dos leads salvos sem WhatsApp, com o que sobrou do orçamento dos segmentos. */
async function enrichLeftovers(campaignId: string, outcomes: SegmentOutcome[], deps: DiscoveryDeps): Promise<void> {
  const available = outcomes.reduce((total, { budget }) => total + budget.remaining("enrich"), 0);
  if (available === 0) {
    await deps.log(campaignId, "Sem orçamento de consultas de bio para enriquecer os leads salvos.", "warn");
    return;
  }

  let used = await deps.enrich(campaignId, { maxCalls: available });
  for (const { budget } of outcomes) {
    while (used > 0 && budget.spend("enrich")) used--;
  }
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
  const { limits } = run.ctx.deps;
  const credits = budget.totalUsed();
  const perLead = run.found > 0 ? (credits / run.found).toFixed(1) : "—";

  return [
    `Resumo:`,
    `buscas ${budget.usedOf("search")}/${limits.maxSearchRequests}`,
    `bios ${budget.usedOf("enrich")}/${limits.maxEnrichCalls}`,
    `buscas de Instagram por nome ${budget.usedOf("lookup")}/${limits.maxLookupRequests}`,
    `resultados brutos ${metrics.raw}`,
    `aprovados ${metrics.approved}`,
    `validados na bio ${metrics.validated}`,
    `fila técnica ${metrics.queued}`,
    `rejeitados ${metrics.rejected}`,
    `repetidos ${metrics.duplicates}`,
    `consolidados entre fontes ${metrics.merged}`,
    `leads novos ${run.found}`,
    `créditos/lead ${perLead}`,
  ].join(" | ");
}
