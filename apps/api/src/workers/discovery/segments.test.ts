import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveSegments } from "./segments";

describe("resolveSegments", () => {
  it("usa a lista quando existe", () => {
    assert.deepEqual(resolveSegments({ categories: ["Hamburgueria", "Pizzaria"], category: "Outra" }), [
      "Hamburgueria",
      "Pizzaria",
    ]);
  });

  it("cai para o texto único dos clientes antigos", () => {
    assert.deepEqual(resolveSegments({ category: "Hamburgueria" }), ["Hamburgueria"]);
    assert.deepEqual(resolveSegments({ categories: [], category: "Hamburgueria" }), ["Hamburgueria"]);
  });

  it("remove vazios, repetidos (sem acento/caixa) e valores que não são texto", () => {
    assert.deepEqual(resolveSegments({ categories: [" Açaí ", "acai", "", 7, null, "Pizzaria"] }), ["Açaí", "Pizzaria"]);
  });

  it("sem nada devolve lista vazia", () => {
    assert.deepEqual(resolveSegments({}), []);
  });

  it("categoria com barra continua sendo um segmento só", () => {
    assert.deepEqual(resolveSegments({ categories: ["Sushi / Japonês"] }), ["Sushi / Japonês"]);
  });
});
