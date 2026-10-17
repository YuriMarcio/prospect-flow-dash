import { classifyBrazilPhone } from "../../lib/phone";
import {
  buildNicheMatcher,
  extractNameFromTitle,
  parseKeyword,
  parseProfileLink,
} from "../instagram/instagram.filters";
import { parseInstagramBio } from "../instagram/instagram.parser";
import { handleAsName, sameBusiness } from "./business-name";
import { decide } from "./classification";
import { matchAddress, matchLocation } from "./location";
import type { DiscoveryRun } from "./run";
import type { MapsPlace } from "./serp.client";

/**
 * Fonte Google Meu Negócio (SerpAPI `google_maps`).
 *
 * Responde "quais estabelecimentos desta categoria existem nesta cidade?", e não "quais perfis
 * parecem ser deles?". O endereço decide a cidade (a busca por si só não garante que o resultado
 * esteja na área); o tipo/nome decide o nicho. Cada negócio aprovado vira um lead com telefone,
 * endereço, nota e site; o Instagram vem do site do cadastro ou, só se faltar canal de contato,
 * de uma busca pelo nome (com orçamento próprio).
 */

const MAX_ALTERNATIVES = 3;
/** Fatia do orçamento de buscas que o Maps pode usar quando o Instagram também foi escolhido. */
const SHARED_BUDGET_SHARE = 0.4;

interface InstagramMatch {
  url: string;
  handle: string;
  snippet: string;
}

export async function runMapsSource(run: DiscoveryRun): Promise<void> {
  const { ctx } = run;
  const { deps, budget } = ctx;

  const matchNiche = buildNicheMatcher(ctx.category);
  const where = ctx.state ? `${ctx.city}, ${ctx.state}` : ctx.city;
  // O bairro só refina a busca; quem valida o endereço continua sendo a cidade (ver matchAddress).
  const area = ctx.neighborhood ? `${ctx.neighborhood}, ${where}` : where;
  const strategies = parseKeyword(ctx.category)
    .slice(0, MAX_ALTERNATIVES)
    .map((alternative) => ({ query: `${alternative} em ${area}`, active: true }));

  const cap = ctx.sources.includes("instagram")
    ? Math.ceil(deps.limits.maxSearchRequests * SHARED_BUDGET_SHARE)
    : deps.limits.maxSearchRequests;
  let used = 0;
  let lookupBudgetLogged = false;
  const seen = new Set<string>();

  await run.log(`Google Meu Negócio: ${strategies.length} busca(s), até ${cap} requisições.`);

  search: for (let page = 0; page < deps.limits.maxPagesPerQuery; page++) {
    const active = strategies.filter((strategy) => strategy.active);
    if (active.length === 0) break;

    for (const strategy of active) {
      if (run.goalReached || run.cancelled) break search;

      if (used >= cap || !budget.spend("search")) {
        run.limited = true;
        await run.log("Limite de buscas do Google Meu Negócio atingido.", "warn");
        break search;
      }
      used++;

      await run.log(`[maps] página ${page + 1}: ${strategy.query}`);

      let places: MapsPlace[];
      try {
        places = await deps.serp.searchMaps({ query: strategy.query, start: page * 20 });
      } catch (err) {
        strategy.active = false;
        run.errors++;
        await run.log(`[maps] busca falhou: ${err instanceof Error ? err.message : String(err)}`, "error");
        continue;
      }

      run.metrics.raw += places.length;
      if (places.length === 0) {
        strategy.active = false;
        await run.log(`[maps] página ${page + 1} vazia. Encerrando esta busca.`, "warn");
        continue;
      }

      let fresh = 0;
      let discarded = 0;
      let considered = 0;
      let otherCity = 0;
      let otherCitySample: string | undefined;

      for (const place of places) {
        if (run.goalReached) break;

        const key = place.place_id ?? place.data_id ?? `${place.title}|${place.address ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        considered++;

        const niche = matchNiche([place.title, place.type ?? "", ...(place.types ?? [])]);
        const location = matchAddress(place.address, ctx.city, ctx.state);
        const decision = decide(niche, location);

        if (location === "mismatch") {
          otherCity++;
          otherCitySample ??= place.address;
        }

        if (decision === "rejected") {
          run.metrics.rejected++;
          discarded++;
          console.log(`[DISCOVERY] descartado (maps ${niche}/${location}): ${place.title} | ${place.address ?? "—"}`);
        } else if (decision === "approved") {
          fresh++;
          run.metrics.approved++;
          await saveBusiness(run, place, {
            lookupBudgetLogged: () => lookupBudgetLogged,
            markLookupBudgetLogged: () => (lookupBudgetLogged = true),
          });
        } else {
          // Sem bio para consultar, não há como resolver o que faltou: vai para a fila técnica.
          run.queue({
            source: "maps",
            dedupe_key: key,
            name: place.title,
            instagram: null,
            place_id: place.place_id ?? place.data_id ?? null,
            address: place.address ?? null,
            niche,
            location,
            reason: decision === "queued" ? "niche_unconfirmed" : "location_unconfirmed",
            evidence: { type: place.type ?? null, types: place.types ?? [] },
          });
        }
      }

      strategy.active = fresh > 0;
      await run.log(`[maps] página ${page + 1}: ${fresh} estabelecimento(s) novo(s) do nicho e da cidade, ${discarded} descartado(s).`);

      // Página inteira com endereço de outra cidade: quase sempre é bairro/região digitado como cidade.
      if (considered > 0 && otherCity === considered) {
        await run.log(
          `[maps] os ${considered} resultados têm endereço fora de "${ctx.city}" (ex.: "${otherCitySample}"). Se "${ctx.city}" é um bairro ou região, informe o município no campo Cidade e o bairro no campo Bairro.`,
          "warn",
        );
      }
      await deps.delay(1000);
    }
  }

  if (!run.goalReached && !run.cancelled && strategies.some((strategy) => strategy.active)) run.limited = true;
}

async function saveBusiness(
  run: DiscoveryRun,
  place: MapsPlace,
  lookupLog: { lookupBudgetLogged: () => boolean; markLookupBudgetLogged: () => void },
): Promise<void> {
  const classified = place.phone ? classifyBrazilPhone(place.phone) : null;
  // Número de central (0800, 4004...) não é celular nem fixo da loja: não serve de contato.
  const phone = classified?.kind === "other" ? null : classified;
  // Só celular é candidato a WhatsApp; o fixo do cadastro fica em `phone`.
  let whatsapp = phone?.kind === "mobile" ? phone.e164 : null;
  let instagram: InstagramMatch | null = null;

  // 1) O que o próprio cadastro já entrega, sem gastar busca.
  if (place.website) {
    const fromSite = parseProfileLink(place.website);
    if (fromSite) instagram = { ...fromSite, snippet: "" };
    else whatsapp ??= parseInstagramBio(place.website).whatsapp;
  }

  // 2) Sem canal de contato direto: procura o Instagram pelo nome (orçamento próprio).
  if (!whatsapp && !instagram) {
    instagram = await lookupInstagram(run, place, lookupLog);
    if (instagram) whatsapp = parseInstagramBio(instagram.snippet).whatsapp;
  }

  // Sem telefone nem Instagram não há como prospectar: não polui o Kanban, vai para a fila técnica.
  if (!phone && !whatsapp && !instagram) {
    run.queue({
      source: "maps",
      dedupe_key: place.place_id ?? place.data_id ?? `${place.title}|${place.address ?? ""}`,
      name: place.title,
      instagram: null,
      place_id: place.place_id ?? place.data_id ?? null,
      address: place.address ?? null,
      niche: "confirmed",
      location: "confirmed",
      reason: "no_contact_channel",
      evidence: { type: place.type ?? null, website: place.website ?? null },
    });
    await run.log(`${place.title}: sem telefone nem Instagram. Foi para a fila técnica.`, "warn");
    return;
  }

  const outcome = await run.saveLead({
    source: "maps",
    identity: {
      name: place.title,
      handle: instagram?.handle,
      phone: phone?.e164 ?? whatsapp,
      placeId: place.place_id ?? place.data_id ?? null,
    },
    fields: {
      name: place.title,
      address: place.address ?? null,
      phone: phone?.e164 ?? null,
      whatsapp,
      google_place_id: place.place_id ?? place.data_id ?? null,
      website: place.website ?? null,
      rating: place.rating ?? null,
      reviews_count: place.reviews ?? null,
      instagram: instagram?.url ?? null,
      notes: instagram?.snippet || null,
    },
  });

  if (outcome === "duplicate") {
    await run.log(`Lead repetido ignorado: ${place.title}`, "warn");
  } else {
    await run.log(
      `#${run.found} | ${place.title} | WA: ${whatsapp ?? "—"} | Tel: ${phone?.e164 ?? "—"} | IG: ${instagram?.url ?? "—"} | Google Meu Negócio`,
    );
  }
}

/** "Burger House (Delivery) - Centro" → "Burger House" */
function searchName(title: string): string {
  return title.replace(/\(.*?\)/g, "").split(" - ")[0].replace(/"/g, "").trim();
}

/**
 * Procura o Instagram de um negócio do Maps pelo nome e cidade. Não aceita o primeiro perfil que
 * aparecer: o nome do perfil precisa ser equivalente ao do estabelecimento e o texto não pode
 * apontar outra cidade. Uma busca por negócio, no máximo.
 */
async function lookupInstagram(
  run: DiscoveryRun,
  place: MapsPlace,
  lookupLog: { lookupBudgetLogged: () => boolean; markLookupBudgetLogged: () => void },
): Promise<InstagramMatch | null> {
  const { deps, budget, city, state } = run.ctx;

  if (!budget.spend("lookup")) {
    run.limited = true;
    if (!lookupLog.lookupBudgetLogged()) {
      lookupLog.markLookupBudgetLogged();
      await run.log("Orçamento de buscas de Instagram por nome esgotado. Próximos negócios ficam sem Instagram.", "warn");
    }
    return null;
  }

  const name = searchName(place.title);
  if (name.length < 3) return null;

  let results;
  try {
    results = await deps.serp.searchGoogle({
      query: `site:instagram.com "${name}" "${city}"`,
      nfpr: deps.limits.useNfpr,
    });
  } catch (err) {
    await run.log(`${place.title}: busca do Instagram falhou: ${err instanceof Error ? err.message : String(err)}`, "warn");
    return null;
  }

  for (const result of results) {
    const profile = parseProfileLink(result.link);
    if (!profile) continue;

    const sameName =
      sameBusiness(extractNameFromTitle(result.title), place.title, city) ||
      sameBusiness(handleAsName(profile.handle), place.title, city);
    if (!sameName) continue;
    if (matchLocation([result.title, result.snippet ?? ""], city, state) === "mismatch") continue;

    return { ...profile, snippet: result.snippet ?? "" };
  }

  return null;
}
