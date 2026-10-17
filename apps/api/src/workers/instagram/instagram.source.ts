import { classifyInstagramResult, type Decision } from "../discovery/classification";
import { matchArea, type LocationEvidence } from "../discovery/location";
import type { DiscoveryRun } from "../discovery/run";
import {
  buildInstagramStrategies,
  buildNicheMatcher,
  extractNameFromTitle,
  type NicheEvidence,
} from "./instagram.filters";
import { parseInstagramBio } from "./instagram.parser";
import { profileToLeadFields, providerRejection } from "./instagram.profile";

/**
 * Fonte Instagram: Google Dorking via SerpAPI.
 *
 * Roda várias estratégias de busca (ver buildInstagramStrategies) em rodadas: a primeira página de
 * cada uma, e só as páginas seguintes das estratégias que acabaram de produzir candidato novo.
 * Cada resultado é classificado (perfil válido? nicho? cidade?) e só então vira lead:
 *
 *   approved → salva direto
 *   pending  → espera o fim das buscas e, se a meta ainda não foi atingida, a bio decide
 *   queued   → fila técnica
 *   rejected → descartado
 */

interface Candidate {
  handle: string;
  url: string;
  name: string;
  title: string;
  snippets: string[];
  decision: Decision;
  niche: NicheEvidence;
  location: LocationEvidence;
  /** open = pendente aguardando validação; os demais são estados finais. */
  status: "open" | "saved" | "duplicate" | "queued" | "rejected";
}

const snippetOf = (candidate: Candidate) => candidate.snippets.join(" \n ");

export async function runInstagramSource(run: DiscoveryRun): Promise<void> {
  const { ctx } = run;
  const { deps, budget } = ctx;

  const classifyCtx = {
    matchNiche: buildNicheMatcher(ctx.category),
    city: ctx.city,
    state: ctx.state,
    neighborhood: ctx.neighborhood,
  };
  const strategies = buildInstagramStrategies(ctx.category, ctx.city, ctx.state, ctx.neighborhood).map((strategy) => ({
    ...strategy,
    active: true,
  }));
  const location = await deps.serp.resolveLocation(ctx.city, ctx.state);
  const candidates = new Map<string, Candidate>();

  await run.log(`Instagram: ${strategies.length} estratégias de busca${location ? ` | local: ${location}` : ""}`);

  search: for (let page = 0; page < deps.limits.maxPagesPerQuery; page++) {
    const active = strategies.filter((strategy) => strategy.active);
    if (active.length === 0) break;

    for (const strategy of active) {
      if (run.goalReached || run.cancelled || run.serpBlocked) break search;

      if (!budget.spend("search")) {
        run.limited = true;
        await run.log(`Orçamento de buscas esgotado (${budget.usedOf("search")} requisições).`, "warn");
        break search;
      }

      await run.log(`[${strategy.id}] página ${page + 1}: ${strategy.query}`);

      let results;
      try {
        results = await deps.serp.searchGoogle({
          query: strategy.query,
          start: page * 10,
          location,
          nfpr: deps.limits.useNfpr,
        });
      } catch (err) {
        strategy.active = false;
        run.errors++;
        if (await run.noteSerpLimit(err)) break search;
        await run.log(`[${strategy.id}] busca falhou: ${err instanceof Error ? err.message : String(err)}`, "error");
        continue;
      }

      run.metrics.raw += results.length;
      if (results.length === 0) {
        strategy.active = false;
        await run.log(`[${strategy.id}] página ${page + 1} vazia. Encerrando esta estratégia.`, "warn");
        continue;
      }

      let fresh = 0;
      let discarded = 0;

      for (const result of results) {
        if (run.goalReached) break;

        const out = classifyInstagramResult(result, classifyCtx);
        if (!out.profile) {
          run.metrics.rejected++;
          discarded++;
          console.log(`[DISCOVERY] descartado (não é perfil): ${result.title} | ${result.link}`);
          continue;
        }

        const known = candidates.get(out.profile.handle);
        if (known) {
          await mergeSighting(run, known, result.snippet ?? "", classifyCtx);
          continue;
        }

        const candidate: Candidate = {
          handle: out.profile.handle,
          url: out.profile.url,
          name: extractNameFromTitle(result.title) || "Desconhecido",
          title: result.title,
          snippets: result.snippet ? [result.snippet] : [],
          decision: out.decision,
          niche: out.niche,
          location: out.location,
          status: "open",
        };
        candidates.set(candidate.handle, candidate);

        if (out.decision === "rejected") {
          candidate.status = "rejected";
          run.metrics.rejected++;
          discarded++;
          console.log(`[DISCOVERY] descartado (${out.niche}/${out.location}): ${result.title} | ${out.profile.url}`);
        } else if (out.decision === "queued") {
          queueCandidate(run, candidate, "niche_unconfirmed");
        } else if (out.decision === "approved") {
          fresh++;
          run.metrics.approved++;
          await saveCandidate(run, candidate);
        } else if (knownFromOtherSource(run, candidate)) {
          // Mesmo negócio já salvo pelo Maps: a cidade foi confirmada pelo endereço dele.
          fresh++;
          run.metrics.approved++;
          await saveCandidate(run, candidate);
        } else {
          fresh++; // pending: segura até o fim das buscas
        }
      }

      // Estratégia só continua se esta página trouxe candidato novo do nicho.
      strategy.active = fresh > 0;
      await run.log(
        `[${strategy.id}] página ${page + 1}: ${fresh} candidato(s) novo(s) do nicho, ${discarded} descartado(s).`,
      );
      if (!strategy.active) {
        await run.log(`[${strategy.id}] sem candidatos novos. Encerrando esta estratégia.`, "warn");
      }

      await deps.delay(1000);
    }
  }

  // Terminou por limite de páginas (e não por falta de resultado) com a meta ainda aberta.
  if (!run.goalReached && !run.cancelled && strategies.some((strategy) => strategy.active)) run.limited = true;

  await validatePending(run, candidates);
}

/** A mesma conta apareceu de novo: o snippet extra pode confirmar a cidade de um pendente. */
async function mergeSighting(
  run: DiscoveryRun,
  candidate: Candidate,
  snippet: string,
  classifyCtx: Parameters<typeof classifyInstagramResult>[1],
): Promise<void> {
  if (candidate.status !== "open" || !snippet || candidate.snippets.includes(snippet)) return;

  candidate.snippets.push(snippet);
  const again = classifyInstagramResult(
    { title: candidate.title, link: candidate.url, snippet: snippetOf(candidate) },
    classifyCtx,
  );
  candidate.location = again.location;
  candidate.decision = again.decision;

  if (again.decision === "approved") {
    run.metrics.approved++;
    await saveCandidate(run, candidate);
  } else if (again.decision === "rejected") {
    candidate.status = "rejected";
    run.metrics.rejected++;
  }
}

async function saveCandidate(
  run: DiscoveryRun,
  candidate: Candidate,
  profileFields: Record<string, unknown> = {},
): Promise<void> {
  const snippet = snippetOf(candidate);
  const parsed = parseInstagramBio(snippet);

  const whatsapp = (profileFields.whatsapp as string | null | undefined) ?? parsed.whatsapp;

  const outcome = await run.saveLead({
    source: "instagram",
    identity: { name: candidate.name, handle: candidate.handle, phone: whatsapp },
    fields: {
      name: candidate.name,
      instagram: candidate.url,
      notes: snippet,
      ...profileFields,
      whatsapp,
      linktree: (profileFields.linktree as string | null | undefined) ?? parsed.linktree,
      delivery_link: (profileFields.delivery_link as string | null | undefined) ?? parsed.digitalMenu,
    },
  });

  candidate.status = outcome === "duplicate" ? "duplicate" : "saved";
  if (outcome === "duplicate") {
    await run.log(`Lead repetido ignorado: ${candidate.name}`, "warn");
  } else if (outcome === "merged") {
    await run.log(`${candidate.name}: já veio do Google Meu Negócio. Instagram adicionado ao mesmo lead.`);
  } else {
    await run.log(`#${run.found} | ${candidate.name} | WA: ${parsed.whatsapp ?? "—"} | ${candidate.url}`);
  }
}

function knownFromOtherSource(run: DiscoveryRun, candidate: Candidate): boolean {
  return run.knowsEstablishment(
    { name: candidate.name, handle: candidate.handle, phone: parseInstagramBio(snippetOf(candidate)).whatsapp },
    "instagram",
  );
}

function queueCandidate(run: DiscoveryRun, candidate: Candidate, reason: string): void {
  candidate.status = "queued";
  run.queue({
    source: "instagram",
    dedupe_key: candidate.handle,
    name: candidate.name,
    instagram: candidate.url,
    place_id: null,
    address: null,
    niche: candidate.niche,
    location: candidate.location,
    reason,
    evidence: { title: candidate.title, snippets: candidate.snippets },
  });
}

/**
 * Pendentes (nicho confirmado, cidade desconhecida): cada um custa 1 consulta de bio, então só
 * valida enquanto a meta não foi atingida e há orçamento. Quem sobra vai para a fila técnica.
 * O DDD do telefone nunca confirma cidade.
 */
async function validatePending(run: DiscoveryRun, candidates: Map<string, Candidate>): Promise<void> {
  const { deps, budget } = run.ctx;
  const pool = [...candidates.values()].filter((candidate) => candidate.status === "open");
  if (pool.length === 0 || run.goalReached || run.cancelled) return;

  await run.log(
    `Validando ${pool.length} candidato(s) sem cidade confirmada pela bio (${budget.remaining("enrich")} consultas no orçamento).`,
  );

  for (const candidate of pool) {
    if (run.goalReached || run.cancelled || run.providerBlocked) break;

    if (knownFromOtherSource(run, candidate)) {
      await saveCandidate(run, candidate);
      continue;
    }

    // Já existe no banco: não gasta consulta, só tenta adotar na campanha de destino.
    const existing = await deps.leads.findByInstagram(candidate.url);
    if (existing) {
      const outcome = await run.adoptExisting(existing);
      candidate.status = outcome === "duplicate" ? "duplicate" : "saved";
      await run.log(
        outcome === "duplicate"
          ? `Lead repetido ignorado: ${candidate.name}`
          : `Lead já existia e foi adicionado à campanha: ${candidate.name}`,
        outcome === "duplicate" ? "warn" : "info",
      );
      continue;
    }

    if (!budget.spend("enrich")) {
      run.limited = true;
      await run.log("Orçamento de consultas de bio esgotado.", "warn");
      break;
    }

    await validateByBio(run, candidate);
    await deps.delay(1200);
  }

  if (run.goalReached || run.cancelled) return;
  for (const candidate of pool.filter((item) => item.status === "open")) {
    const reason = run.providerBlocked
      ? "profile_provider_blocked"
      : budget.remaining("enrich") === 0
        ? "enrich_budget_exhausted"
        : "not_validated";
    queueCandidate(run, candidate, reason);
  }
}

async function validateByBio(run: DiscoveryRun, candidate: Candidate): Promise<void> {
  const { deps, city, state, neighborhood } = run.ctx;

  let profile;
  try {
    profile = await deps.profiles.fetch(candidate.handle);
  } catch (err) {
    run.errors++;
    const rejected = providerRejection(err);
    if (rejected) {
      run.providerBlocked = true;
      await run.log(
        `O provedor de perfis do Instagram recusou a consulta (HTTP ${rejected}): créditos esgotados ou chave inválida. Validação por bio interrompida.`,
        "error",
      );
    } else {
      await run.log(`${candidate.name}: consulta de bio falhou: ${err instanceof Error ? err.message : String(err)}`, "warn");
    }
    queueCandidate(run, candidate, rejected ? "profile_provider_blocked" : "profile_fetch_failed");
    return;
  }

  if (!profile) {
    queueCandidate(run, candidate, "profile_not_found");
    return;
  }

  const location = matchArea([profile.full_name ?? "", profile.biography ?? "", snippetOf(candidate)], city, state, neighborhood);

  if (location === "mismatch") {
    candidate.status = "rejected";
    run.metrics.rejected++;
    await run.log(`${candidate.name}: bio indica outra cidade. Descartado.`, "warn");
    return;
  }

  if (location === "unknown") {
    candidate.location = "unknown";
    queueCandidate(run, candidate, "location_unconfirmed");
    await run.log(`${candidate.name}: bio não confirma a cidade. Foi para a fila técnica.`, "warn");
    return;
  }

  candidate.location = "confirmed";
  run.metrics.validated++;
  await saveCandidate(run, candidate, profileToLeadFields(profile));
}
