import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildInstagramStrategies } from "../instagram/instagram.filters";
import type { ScrapeCreatorsProfile } from "../instagram/instagram.profile";
import { runDiscovery } from "./discovery.worker";
import type { QueuedCandidate } from "./candidates.repository";
import type { CampaignStatsPatch, DiscoveryDeps, DiscoveryInput } from "./run";
import type { MapsPlace, SerpOrganicResult } from "./serp.client";

const ig = (handle: string, title: string, snippet = ""): SerpOrganicResult => ({
  title,
  link: `https://www.instagram.com/${handle}/`,
  snippet,
});

/** Nicho e cidade confirmados no snippet. */
const approved = (n: number) => ig(`burger${n}`, `Burger ${n} Hamburgueria`, "Hamburgueria • Santa Inês - MA");
/** Nicho confirmado, sem cidade: depende da bio. */
const pending = (n: number) => ig(`pend${n}burguer`, `Pend ${n} Burger`, "o melhor hambúrguer");
const junk = (n: number) => ig(`junk${n}`, `Pessoa ${n}`, "fotos de viagem");

const INPUT: DiscoveryInput = {
  category: "Hamburgueria",
  city: "Santa Inês",
  state: "MA",
  quantity: 10,
  sources: ["instagram"],
};

const STRATEGIES = Object.fromEntries(
  buildInstagramStrategies(INPUT.category, INPUT.city, INPUT.state).map((strategy) => [strategy.id, strategy.query]),
);

interface Setup {
  /** Resultados por query e página (0 = primeira). Query/página fora do script devolve vazio. */
  pages?: Record<string, SerpOrganicResult[][]>;
  /** Resultados do Google Maps por query e página (20 por página). */
  mapsPages?: Record<string, MapsPlace[][]>;
  profiles?: Record<string, ScrapeCreatorsProfile | null>;
  existing?: string[];
  limits?: Partial<DiscoveryDeps["limits"]>;
  cancelAfterSearches?: number;
}

function setup({ pages = {}, mapsPages = {}, profiles = {}, existing = [], limits = {}, cancelAfterSearches }: Setup = {}) {
  const searches: Array<{ query: string; start: number }> = [];
  const mapsSearches: Array<{ query: string; start: number }> = [];
  const fetched: string[] = [];
  const saved: Array<Record<string, unknown>> = [];
  const patches: CampaignStatsPatch[] = [];
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const logs: string[] = [];
  let queued: QueuedCandidate[] = [];
  const store = new Map<string, { id: string; name: string | null; prospecting_campaign_id: string | null }>(
    existing.map((url) => [url, { id: `old-${url}`, name: "antigo", prospecting_campaign_id: null }]),
  );

  const deps: DiscoveryDeps = {
    serp: {
      async searchMaps({ query, start = 0 }) {
        mapsSearches.push({ query, start });
        return mapsPages[query]?.[start / 20] ?? [];
      },
      async searchGoogle({ query, start = 0 }) {
        searches.push({ query, start });
        return pages[query]?.[start / 10] ?? [];
      },
      async resolveLocation() {
        return null;
      },
    },
    limits: { maxSearchRequests: 15, maxPagesPerQuery: 3, maxLookupRequests: 20, maxEnrichCalls: 25, useNfpr: true, ...limits },
    leads: {
      async createUnique(data) {
        const url = data.instagram as string;
        const hit = store.get(url);
        if (hit) return { lead: hit, created: false };
        const lead = { id: `new-${store.size}`, name: data.name as string, prospecting_campaign_id: null };
        store.set(url, lead);
        saved.push(data);
        return { lead, created: true };
      },
      async adoptDuplicate() {
        return "other";
      },
      async findByInstagram(url) {
        return store.get(url) ?? null;
      },
      async update(id, data) {
        updates.push({ id, data });
      },
    },
    campaigns: {
      async updateStats(_id, patch) {
        patches.push(patch);
      },
    },
    profiles: {
      async fetch(handle) {
        fetched.push(handle);
        return profiles[handle] ?? null;
      },
    },
    candidates: {
      async save(rows) {
        queued = rows;
        return { persisted: true };
      },
    },
    async enrich() {
      return 0;
    },
    async log(_id, message) {
      logs.push(message);
    },
    isCancelled: () => cancelAfterSearches !== undefined && searches.length >= cancelAfterSearches,
    cleanup() {},
    async delay() {},
  };

  return {
    deps,
    searches,
    mapsSearches,
    updates,
    fetched,
    saved,
    logs,
    patches,
    queued: () => queued,
    final: () => patches.at(-1),
  };
}

describe("runDiscovery (Instagram)", () => {
  it("só aprofunda a estratégia que ainda rende e para a que esgotou", async () => {
    const s = setup({
      pages: {
        [STRATEGIES.category]: [[approved(1), approved(2)], [junk(1), junk(2)]],
        [STRATEGIES.synonyms]: [[approved(3)], [approved(4)], [approved(5)]],
      },
    });

    await runDiscovery("c1", { ...INPUT, quantity: 50 }, s.deps);

    const pagesOf = (id: string) => s.searches.filter((call) => call.query === STRATEGIES[id]).map((call) => call.start);
    assert.deepEqual(pagesOf("category"), [0, 10]); // página 2 só trouxe lixo: não vai à 3
    assert.deepEqual(pagesOf("synonyms"), [0, 10, 20]); // rendeu até o teto de páginas
    assert.deepEqual(pagesOf("delivery"), [0]); // vazia na primeira
    assert.equal(s.saved.length, 5);
  });

  it("respeita o orçamento de buscas e marca budget_exhausted", async () => {
    const s = setup({
      limits: { maxSearchRequests: 2 },
      pages: { [STRATEGIES.category]: [[approved(1)]], [STRATEGIES.synonyms]: [[approved(2)]], [STRATEGIES.delivery]: [[approved(3)]] },
    });

    await runDiscovery("c1", INPUT, s.deps);

    assert.equal(s.searches.length, 2);
    assert.equal(s.final()?.completion_reason, "budget_exhausted");
    assert.equal(s.final()?.status, "done");
  });

  it("para ao atingir a meta e marca goal_reached", async () => {
    const s = setup({
      pages: { [STRATEGIES.category]: [[approved(1), approved(2), approved(3)]] },
    });

    await runDiscovery("c1", { ...INPUT, quantity: 2 }, s.deps);

    assert.equal(s.saved.length, 2);
    assert.equal(s.final()?.found, 2);
    assert.equal(s.final()?.completion_reason, "goal_reached");
    assert.equal(s.searches.length, 1);
  });

  it("sem nada relevante, termina como sources_exhausted com 0 leads", async () => {
    const s = setup({ pages: { [STRATEGIES.category]: [[junk(1), junk(2), junk(3)]] } });

    await runDiscovery("c1", INPUT, s.deps);

    assert.equal(s.saved.length, 0);
    assert.equal(s.final()?.found, 0);
    assert.equal(s.final()?.completion_reason, "sources_exhausted");
  });

  it("duplicado não conta para a meta", async () => {
    const s = setup({
      existing: ["https://www.instagram.com/burger1/"],
      pages: { [STRATEGIES.category]: [[approved(1), approved(2)]] },
    });

    await runDiscovery("c1", INPUT, s.deps);

    assert.equal(s.saved.length, 1);
    assert.equal(s.final()?.found, 1);
  });

  it("a mesma conta em duas estratégias conta uma vez", async () => {
    const s = setup({
      pages: { [STRATEGIES.category]: [[approved(1)]], [STRATEGIES.synonyms]: [[approved(1)]] },
    });

    await runDiscovery("c1", INPUT, s.deps);

    assert.equal(s.saved.length, 1);
    assert.equal(s.final()?.found, 1);
  });

  it("snippet de outra estratégia confirma a cidade e dispensa a consulta de bio", async () => {
    const withCity = ig("pend1burguer", "Pend 1 Burger", "hambúrguer artesanal em Santa Inês - MA");
    const s = setup({
      pages: { [STRATEGIES.category]: [[pending(1)]], [STRATEGIES.synonyms]: [[withCity]] },
    });

    await runDiscovery("c1", INPUT, s.deps);

    assert.equal(s.saved.length, 1);
    assert.deepEqual(s.fetched, []);
  });

  it("pendente: a bio confirma, não confirma ou indica outra cidade", async () => {
    const s = setup({
      pages: { [STRATEGIES.category]: [[pending(1), pending(2), pending(3)]] },
      profiles: {
        pend1burguer: { biography: "Hamburgueria em Santa Inês - MA 🍔", follower_count: 900 },
        pend2burguer: { biography: "O melhor burger, peça já!" },
        pend3burguer: { biography: "Hambúrguer em Salvador - BA" },
      },
    });

    await runDiscovery("c1", INPUT, s.deps);

    assert.deepEqual(s.fetched, ["pend1burguer", "pend2burguer", "pend3burguer"]);
    assert.equal(s.saved.length, 1);
    assert.equal(s.saved[0].instagram, "https://www.instagram.com/pend1burguer/");
    assert.equal(s.saved[0].followers, 900);
    assert.ok(s.saved[0].enriched_at, "lead validado já sai com enriched_at, para não ser consultado de novo");
    assert.deepEqual(s.queued().map((row) => [row.dedupe_key, row.reason]), [["pend2burguer", "location_unconfirmed"]]);
    assert.equal(s.final()?.found, 1);
  });

  it("orçamento de bios: o que sobra vai para a fila técnica sem consulta", async () => {
    const confirmed: ScrapeCreatorsProfile = { biography: "Burger de Santa Inês/MA" };
    const s = setup({
      limits: { maxEnrichCalls: 1 },
      pages: { [STRATEGIES.category]: [[pending(1), pending(2)]] },
      profiles: { pend1burguer: confirmed, pend2burguer: confirmed },
    });

    await runDiscovery("c1", INPUT, s.deps);

    assert.deepEqual(s.fetched, ["pend1burguer"]);
    assert.equal(s.saved.length, 1);
    assert.deepEqual(s.queued().map((row) => row.reason), ["enrich_budget_exhausted"]);
    assert.equal(s.final()?.completion_reason, "budget_exhausted");
  });

  it("pendente que já existe no banco não gasta consulta de bio", async () => {
    const s = setup({
      existing: ["https://www.instagram.com/pend1burguer/"],
      pages: { [STRATEGIES.category]: [[pending(1)]] },
    });

    await runDiscovery("c1", INPUT, s.deps);

    assert.deepEqual(s.fetched, []);
    assert.equal(s.saved.length, 0);
  });

  it("nicho desconhecido com cidade confirmada vai para a fila técnica", async () => {
    const s = setup({
      pages: { [STRATEGIES.category]: [[ig("studiopilates", "Studio Pilates", "Aulas em Santa Inês - MA")]] },
    });

    await runDiscovery("c1", INPUT, s.deps);

    assert.equal(s.saved.length, 0);
    assert.deepEqual(s.queued().map((row) => row.reason), ["niche_unconfirmed"]);
  });

  it("cancelada no meio: não marca como concluída", async () => {
    const s = setup({
      cancelAfterSearches: 1,
      pages: { [STRATEGIES.category]: [[approved(1)]] },
    });

    await runDiscovery("c1", INPUT, s.deps);

    assert.notEqual(s.final()?.status, "done");
  });

  it("estatísticas acompanham só leads válidos", async () => {
    const s = setup({
      pages: { [STRATEGIES.category]: [[junk(1), approved(1), junk(2), approved(2)]] },
    });

    await runDiscovery("c1", INPUT, s.deps);

    const progress = s.patches.filter((patch) => patch.found !== undefined && patch.status === undefined);
    assert.deepEqual(progress.map((patch) => patch.found), [1, 2]);
  });
});

const MAPS_QUERY = "Hamburgueria em Santa Inês, MA";
const ADDRESS = "R. Tal, 10 - Centro, Santa Inês - MA, 65300-000, Brasil";

const business = (over: Partial<MapsPlace> = {}): MapsPlace => ({
  title: "Zelândia Burger",
  place_id: "p1",
  type: "Hamburgueria",
  address: ADDRESS,
  phone: "(98) 98888-7777",
  rating: 4.7,
  reviews: 120,
  ...over,
});

const MAPS_INPUT: DiscoveryInput = { ...INPUT, sources: ["maps"] };

describe("runDiscovery (Google Meu Negócio)", () => {
  it("celular do cadastro vira WhatsApp e não gasta busca de Instagram", async () => {
    const s = setup({ mapsPages: { [MAPS_QUERY]: [[business()]] } });

    await runDiscovery("c1", MAPS_INPUT, s.deps);

    assert.equal(s.searches.length, 0);
    assert.equal(s.saved.length, 1);
    assert.equal(s.saved[0].whatsapp, "+5598988887777");
    assert.equal(s.saved[0].phone, "+5598988887777");
    assert.equal(s.saved[0].google_place_id, "p1");
    assert.equal(s.saved[0].rating, 4.7);
    assert.equal(s.saved[0].source, "maps");
    assert.equal(s.final()?.found, 1);
  });

  it("telefone fixo não vira WhatsApp e dispara a busca do Instagram pelo nome", async () => {
    const lookup = 'site:instagram.com "Zelândia Burger" "Santa Inês"';
    const s = setup({
      mapsPages: { [MAPS_QUERY]: [[business({ phone: "(98) 3333-4444" })]] },
      pages: {
        [lookup]: [[ig("zelandiaburger", "Zelândia Burger (@zelandiaburger)", "Pedidos wa.me/5598977776666")]],
      },
    });

    await runDiscovery("c1", MAPS_INPUT, s.deps);

    assert.deepEqual(s.searches.map((call) => call.query), [lookup]);
    assert.equal(s.saved[0].phone, "+559833334444");
    assert.equal(s.saved[0].instagram, "https://www.instagram.com/zelandiaburger/");
    assert.equal(s.saved[0].whatsapp, "+5598977776666"); // veio da bio do Instagram
  });

  it("não aceita o primeiro perfil que aparecer: o nome precisa ser do mesmo negócio", async () => {
    const lookup = 'site:instagram.com "Zelândia Burger" "Santa Inês"';
    const s = setup({
      mapsPages: { [MAPS_QUERY]: [[business({ phone: undefined })]] },
      pages: { [lookup]: [[ig("outrolugar", "Outro Lugar Hamburgueria", "Santa Inês - MA")]] },
    });

    await runDiscovery("c1", MAPS_INPUT, s.deps);

    assert.equal(s.saved.length, 1);
    assert.equal(s.saved[0].instagram, null);
  });

  it("Instagram no site do cadastro dispensa a busca", async () => {
    const s = setup({
      mapsPages: { [MAPS_QUERY]: [[business({ phone: "(98) 3333-4444", website: "https://instagram.com/zelandiaburger" })]] },
    });

    await runDiscovery("c1", MAPS_INPUT, s.deps);

    assert.equal(s.searches.length, 0);
    assert.equal(s.saved[0].instagram, "https://www.instagram.com/zelandiaburger/");
  });

  it("endereço de outra cidade é rejeitado; outro tipo de negócio vai para a fila", async () => {
    const s = setup({
      mapsPages: {
        [MAPS_QUERY]: [
          [
            business({ place_id: "a", address: "Av. X, 1 - Centro, São Luís - MA, 65000-000, Brasil" }),
            business({ place_id: "b", title: "Academia Força", type: "Academia" }),
          ],
        ],
      },
    });

    await runDiscovery("c1", MAPS_INPUT, s.deps);

    assert.equal(s.saved.length, 0);
    assert.deepEqual(s.queued().map((row) => [row.place_id, row.reason]), [["b", "niche_unconfirmed"]]);
  });

  it("limite de lookups: o negócio entra sem Instagram e a campanha fica budget_exhausted", async () => {
    const s = setup({
      limits: { maxLookupRequests: 0 },
      mapsPages: { [MAPS_QUERY]: [[business({ phone: undefined })]] },
    });

    await runDiscovery("c1", MAPS_INPUT, s.deps);

    assert.equal(s.saved.length, 1);
    assert.equal(s.final()?.completion_reason, "budget_exhausted");
  });

  it("com o Instagram também escolhido, o Maps usa no máximo 40% do orçamento de buscas", async () => {
    const pagesOfBusinesses = Array.from({ length: 10 }, (_, page) => [
      business({ place_id: `p${page}`, title: `Lugar ${page} Burger` }),
    ]);
    const s = setup({
      limits: { maxSearchRequests: 10, maxPagesPerQuery: 10 },
      mapsPages: { [MAPS_QUERY]: pagesOfBusinesses },
    });

    await runDiscovery("c1", { ...INPUT, quantity: 50, sources: ["maps", "instagram"] }, s.deps);

    assert.equal(s.mapsSearches.length, 4);
  });
});

describe("consolidação entre fontes", () => {
  it("o mesmo negócio no Maps e no Instagram vira um lead só, com os dois canais", async () => {
    const s = setup({
      limits: { maxLookupRequests: 0 }, // o Maps não acha o Instagram sozinho
      mapsPages: { [MAPS_QUERY]: [[business({ phone: "(98) 3333-4444" })]] },
      pages: {
        [STRATEGIES.category]: [[ig("zelandiaburger", "Zelândia Burger (@zelandiaburger)", "Hamburgueria • Santa Inês - MA")]],
      },
    });

    await runDiscovery("c1", { ...INPUT, sources: ["maps", "instagram"] }, s.deps);

    assert.equal(s.saved.length, 1, "um lead só");
    assert.equal(s.final()?.found, 1, "e conta uma vez");
    assert.equal(s.updates.length, 1);
    assert.equal(s.updates[0].data.instagram, "https://www.instagram.com/zelandiaburger/");
  });

  it("mesmo telefone também consolida, mesmo com nomes diferentes", async () => {
    const s = setup({
      limits: { maxLookupRequests: 0 },
      mapsPages: { [MAPS_QUERY]: [[business({ title: "Restaurante do Zé", type: "Hamburgueria", phone: "(98) 98888-7777" })]] },
      pages: {
        [STRATEGIES.category]: [[ig("zeburgers", "Zé Burgers", "Hamburgueria Santa Inês - MA. Pedidos wa.me/5598988887777")]],
      },
    });

    await runDiscovery("c1", { ...INPUT, sources: ["maps", "instagram"] }, s.deps);

    assert.equal(s.saved.length, 1);
    assert.equal(s.updates[0].data.instagram, "https://www.instagram.com/zeburgers/");
  });

  it("negócios diferentes continuam separados", async () => {
    const s = setup({
      limits: { maxLookupRequests: 0 },
      mapsPages: { [MAPS_QUERY]: [[business({ phone: "(98) 3333-4444" })]] },
      pages: {
        [STRATEGIES.category]: [[ig("atlantidaburger", "Atlântida Burger", "Hamburgueria • Santa Inês - MA")]],
      },
    });

    await runDiscovery("c1", { ...INPUT, sources: ["maps", "instagram"] }, s.deps);

    assert.equal(s.saved.length, 2);
    assert.equal(s.final()?.found, 2);
  });
});
