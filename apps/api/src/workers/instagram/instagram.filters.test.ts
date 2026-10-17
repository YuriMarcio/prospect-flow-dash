import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildInstagramStrategies, extractNameFromTitle } from "./instagram.filters";

describe("extractNameFromTitle", () => {
  it("tira o sufixo do Instagram e a localização que ele acrescenta", () => {
    assert.equal(extractNameFromTitle("722burger • Instagram photos and videos"), "722burger");
    assert.equal(extractNameFromTitle("Burger Kings SLZ (@burgerkingsslz) • Fotos e vídeos do Instagram"), "Burger Kings SLZ");
    assert.equal(extractNameFromTitle("Casa do Zé - Instagram"), "Casa do Zé");
    assert.equal(extractNameFromTitle("rosnalhamburgueria · Barreirinhas, MA"), "rosnalhamburgueria");
  });

  it("mantém nomes que têm bolinha como parte do título", () => {
    assert.equal(extractNameFromTitle("Gabs Burguer • Hamburgueria"), "Gabs Burguer • Hamburgueria");
    assert.equal(extractNameFromTitle("One Hamburgueria"), "One Hamburgueria");
  });
});

describe("buildInstagramStrategies", () => {
  it("gera 4 estratégias distintas com UF", () => {
    const strategies = buildInstagramStrategies("Hamburgueria", "Santa Inês", "MA");
    assert.deepEqual(strategies.map((strategy) => strategy.id), ["category", "synonyms", "delivery", "geo"]);
    assert.equal(strategies[0].query, 'site:instagram.com "Hamburgueria" "Santa Inês"');
    assert.equal(strategies[1].query, 'site:instagram.com ("burger" OR "burguer" OR "hambúrguer" OR "hamburguer") "Santa Inês"');
    assert.equal(strategies[3].query.endsWith('"Santa Inês" "MA"'), true);
  });

  it("sem UF a quarta vira a variante com whatsapp", () => {
    const strategies = buildInstagramStrategies("Hamburgueria", "Santa Inês", null);
    assert.equal(strategies.at(-1)?.id, "whatsapp");
  });

  it("categoria sem família de sinônimos não cria a estratégia de sinônimos", () => {
    const ids = buildInstagramStrategies("Pet Shop", "Santa Inês", "MA").map((strategy) => strategy.id);
    assert.deepEqual(ids, ["category", "delivery", "geo"]);
  });

  it("categoria com barra vira OR de frases", () => {
    const [category] = buildInstagramStrategies("Estética / Spa", "Santa Inês", "MA");
    assert.equal(category.query, 'site:instagram.com ("Estética" OR "Spa") "Santa Inês"');
  });

  it("com bairro, bairro e cidade entram como termos separados em todas as estratégias", () => {
    const strategies = buildInstagramStrategies("Hamburgueria", "Rio de Janeiro", "RJ", "Ilha do Governador");
    assert.equal(strategies[0].query, 'site:instagram.com "Hamburgueria" "Ilha do Governador" "Rio de Janeiro"');
    assert.equal(strategies.every((strategy) => strategy.query.includes('"Ilha do Governador" "Rio de Janeiro"')), true);
  });

  it("bairro vazio ou só espaços não muda a busca", () => {
    const sem = buildInstagramStrategies("Hamburgueria", "Santa Inês", "MA");
    assert.deepEqual(buildInstagramStrategies("Hamburgueria", "Santa Inês", "MA", "  "), sem);
    assert.deepEqual(buildInstagramStrategies("Hamburgueria", "Santa Inês", "MA", null), sem);
  });
});
