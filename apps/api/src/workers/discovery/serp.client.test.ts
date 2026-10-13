import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSerpClient } from "./serp.client";

type Call = { url: string; params?: Record<string, unknown> };

/** http falso: cada resposta pode ser um valor ou um erro. */
function fakeHttp(responses: Array<unknown | Error>) {
  const calls: Call[] = [];
  const http = (async (url: string, config?: { params?: Record<string, unknown> }) => {
    calls.push({ url, params: config?.params });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return { data: next };
  }) as Parameters<typeof createSerpClient>[1];
  return { http, calls };
}

const timeout = Object.assign(new Error("timeout of 30000ms exceeded"), { code: "ECONNABORTED" });
const httpError = (status: number) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status } });

describe("searchGoogle", () => {
  it("repete uma vez em timeout e devolve o resultado", async () => {
    const { http, calls } = fakeHttp([timeout, { organic_results: [{ title: "A", link: "https://x.com", snippet: "" }] }]);
    const client = createSerpClient("key", http, 0);

    const results = await client.searchGoogle({ query: "q" });

    assert.equal(results.length, 1);
    assert.equal(calls.length, 2);
  });

  it("não repete erro 4xx (chave, plano)", async () => {
    const { http, calls } = fakeHttp([httpError(401)]);
    const client = createSerpClient("key", http, 0);

    await assert.rejects(client.searchGoogle({ query: "q" }), /401/);
    assert.equal(calls.length, 1);
  });

  it("repete 5xx uma vez e, se falhar de novo, propaga", async () => {
    const { http, calls } = fakeHttp([httpError(503), httpError(503)]);
    const client = createSerpClient("key", http, 0);

    await assert.rejects(client.searchGoogle({ query: "q" }), /503/);
    assert.equal(calls.length, 2);
  });

  it("'não retornou resultados' é página vazia, não erro", async () => {
    const { http } = fakeHttp([{ error: "Google hasn't returned any results for this query." }]);
    assert.deepEqual(await createSerpClient("key", http, 0).searchGoogle({ query: "q" }), []);
  });

  it("envia location e nfpr só quando pedidos", async () => {
    const { http, calls } = fakeHttp([{ organic_results: [] }, { organic_results: [] }]);
    const client = createSerpClient("key", http, 0);

    await client.searchGoogle({ query: "q", location: "Sao Luis,State of Maranhao,Brazil", nfpr: true });
    await client.searchGoogle({ query: "q" });

    assert.equal(calls[0].params?.location, "Sao Luis,State of Maranhao,Brazil");
    assert.equal(calls[0].params?.nfpr, 1);
    assert.equal("location" in (calls[1].params ?? {}), false);
    assert.equal("nfpr" in (calls[1].params ?? {}), false);
  });
});

describe("searchMaps", () => {
  it("lê local_results e, se vier lugar único, place_results", async () => {
    const { http } = fakeHttp([{ local_results: [{ title: "A" }, { title: "B" }] }, { place_results: { title: "Único" } }]);
    const client = createSerpClient("key", http, 0);

    assert.equal((await client.searchMaps({ query: "q" })).length, 2);
    assert.deepEqual((await client.searchMaps({ query: "q" })).map((place) => place.title), ["Único"]);
  });

  it("pagina de 20 em 20 com engine google_maps", async () => {
    const { http, calls } = fakeHttp([{ local_results: [] }]);
    await createSerpClient("key", http, 0).searchMaps({ query: "q", start: 40 });

    assert.equal(calls[0].params?.engine, "google_maps");
    assert.equal(calls[0].params?.type, "search");
    assert.equal(calls[0].params?.start, 40);
  });
});

describe("resolveLocation", () => {
  const saoLuis = [
    { canonical_name: "Sao Luis do Quitunde,State of Alagoas,Brazil", country_code: "BR", target_type: "City" },
    { canonical_name: "Sao Luis,State of Maranhao,Brazil", country_code: "BR", target_type: "City" },
  ];

  it("escolhe a cidade da UF certa e guarda em cache", async () => {
    const { http, calls } = fakeHttp([saoLuis]);
    const client = createSerpClient("key", http, 0);

    assert.equal(await client.resolveLocation("São Luís", "MA"), "Sao Luis,State of Maranhao,Brazil");
    assert.equal(await client.resolveLocation("São Luís", "MA"), "Sao Luis,State of Maranhao,Brazil");
    assert.equal(calls.length, 1);
  });

  it("cidade fora da base da SerpAPI (ex.: Barreirinhas) devolve null sem erro", async () => {
    const { http } = fakeHttp([[]]);
    assert.equal(await createSerpClient("key", http, 0).resolveLocation("barreirinhas", "MA"), null);
  });

  it("sem UF não tenta resolver", async () => {
    const { http, calls } = fakeHttp([]);
    assert.equal(await createSerpClient("key", http, 0).resolveLocation("São Luís", null), null);
    assert.equal(calls.length, 0);
  });

  it("falha na API de localização não derruba a busca", async () => {
    const { http } = fakeHttp([httpError(500), httpError(500)]);
    assert.equal(await createSerpClient("key", http, 0).resolveLocation("São Luís", "MA"), null);
  });
});
