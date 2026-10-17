import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildNicheMatcher, parseProfileLink } from "../instagram/instagram.filters";
import { classifyInstagramResult, decide } from "./classification";
import { matchAddress, matchArea, matchLocation, normalizeUf } from "./location";
import { SANTA_INES_RESULTS } from "./fixtures/santa-ines-hamburgueria";

const matchNiche = buildNicheMatcher("Hamburgueria");
const ctx = { matchNiche, city: "Santa Inês", state: "MA" };

describe("fixture do log de Santa Inês", () => {
  const classified = SANTA_INES_RESULTS.map((result) => ({
    result,
    out: classifyInstagramResult(result, ctx),
  }));

  it("os seis primeiros continuam sendo candidatos do nicho", () => {
    for (const { result, out } of classified.slice(0, 6)) {
      assert.equal(out.niche, "confirmed", `#${result.position} ${result.title}`);
    }
  });

  it("sem cidade no texto, candidato do nicho fica pendente e nunca aprovado", () => {
    for (const { result, out } of classified.slice(0, 6)) {
      assert.equal(out.decision, "pending", `#${result.position} ${result.title}`);
    }
  });

  it("páginas do próprio Instagram são rejeitadas", () => {
    const helpPages = classified.filter(({ result }) => /help\.instagram|privacycenter/.test(result.link));
    assert.equal(helpPages.length, 9); // #13, 15, 18, 22, 24, 29, 30, 33, 40
    for (const { out } of helpPages) {
      assert.equal(out.profile, null);
      assert.equal(out.decision, "rejected");
    }
  });

  it("perfis alheios ao setor são rejeitados", () => {
    for (const { result, out } of classified.slice(6)) {
      assert.equal(out.decision, "rejected", `#${result.position} ${result.title}`);
    }
  });
});

describe("decide", () => {
  it("cobre a tabela de decisão", () => {
    assert.equal(decide("confirmed", "confirmed"), "approved");
    assert.equal(decide("confirmed", "unknown"), "pending");
    assert.equal(decide("confirmed", "mismatch"), "rejected");
    assert.equal(decide("unknown", "confirmed"), "queued");
    assert.equal(decide("unknown", "unknown"), "rejected");
    assert.equal(decide("unknown", "mismatch"), "rejected");
  });

  it("snippet que cita a cidade aprova; outra UF rejeita", () => {
    const base = { title: "Casa do Burger", link: "https://www.instagram.com/casadoburger/" };
    assert.equal(
      classifyInstagramResult({ ...base, snippet: "Hamburgueria artesanal • Santa Inês - MA" }, ctx).decision,
      "approved",
    );
    assert.equal(
      classifyInstagramResult({ ...base, snippet: "Hamburgueria artesanal • Santa Inês - BA" }, ctx).decision,
      "rejected",
    );
  });
});

describe("parseProfileLink", () => {
  it("aceita só perfil e devolve URL canônica", () => {
    assert.deepEqual(parseProfileLink("https://instagram.com/BoboJLe?hl=pt"), {
      url: "https://www.instagram.com/bobojle/",
      handle: "bobojle",
    });
    assert.equal(parseProfileLink("https://www.instagram.com/p/ABC123/"), null);
    assert.equal(parseProfileLink("https://www.instagram.com/someone/reel/ABC/"), null);
    assert.equal(parseProfileLink("https://www.instagram.com/explore/tags/burger/"), null);
    assert.equal(parseProfileLink("https://help.instagram.com/513918941996087"), null);
  });
});

describe("matchLocation", () => {
  it("cidade citada confirma; com a UF buscada também", () => {
    assert.equal(matchLocation(["Delivery em Santa Ines"], "Santa Inês", "MA"), "confirmed");
    assert.equal(matchLocation(["Santa Inês/MA"], "Santa Inês", "MA"), "confirmed");
  });

  it("mesma cidade com outra UF é mismatch (existem várias Santa Inês)", () => {
    assert.equal(matchLocation(["Santa Inês - BA"], "Santa Inês", "MA"), "mismatch");
  });

  it("outra cidade com outra UF é mismatch; sem evidência é unknown", () => {
    assert.equal(matchLocation(["Av. Paulista, São Paulo - SP"], "Santa Inês", "MA"), "mismatch");
    assert.equal(matchLocation(["Os melhores burgers da cidade"], "Santa Inês", "MA"), "unknown");
  });

  it("outra cidade da MESMA UF é unknown, não mismatch: descartar vizinha seria perda irreversível", () => {
    assert.equal(matchLocation(["Hambúrguer em São Luís - MA"], "Santa Inês", "MA"), "unknown");
  });

  it("'- Se' em minúsculo não vira Sergipe", () => {
    assert.equal(matchLocation(["45 publicações - Se você curte burger"], "Santa Inês", "MA"), "unknown");
  });

  it("DDD no texto não confirma cidade", () => {
    assert.equal(matchLocation(["Pedidos: (98) 98888-7777"], "Santa Inês", "MA"), "unknown");
  });
});

describe("matchArea (cidade + bairro)", () => {
  const city = "Rio de Janeiro";
  const bairro = "Ilha do Governador";

  it("perfil que cita só o bairro é confirmado quando a cidade não aparece", () => {
    const texts = ["Lanches 📍Ilha do Governador ⏰ Terça a domingo"];
    assert.equal(matchLocation(texts, city, "RJ"), "unknown");
    assert.equal(matchArea(texts, city, "RJ", bairro), "confirmed");
  });

  it("sem bairro (ou bairro vazio) é exatamente o matchLocation", () => {
    const texts = ["Lanches 📍Ilha do Governador"];
    assert.equal(matchArea(texts, city, "RJ"), "unknown");
    assert.equal(matchArea(texts, city, "RJ", "  "), "unknown");
  });

  it("o bairro não anula evidência contrária da cidade ou da UF", () => {
    assert.equal(matchArea(["Ilha do Governador, São Paulo - SP"], city, "RJ", bairro), "mismatch");
  });

  it("a cidade citada continua confirmando sem precisar do bairro", () => {
    assert.equal(matchArea(["Hamburgueria • Rio de Janeiro - RJ"], city, "RJ", bairro), "confirmed");
  });

  it("nem cidade nem bairro: unknown", () => {
    assert.equal(matchArea(["Os melhores burgers"], city, "RJ", bairro), "unknown");
  });

  it("classificação do Instagram: com o bairro no snippet o candidato é aprovado, sem ele fica pendente", () => {
    const result = {
      title: "Brave Hero Hamburgueria",
      link: "https://www.instagram.com/bravehero/",
      snippet: "Hamburgueria temática 📍Ilha do Governador",
    };
    const base = { matchNiche, city, state: "RJ" };

    assert.equal(classifyInstagramResult(result, base).decision, "pending");
    assert.equal(classifyInstagramResult(result, { ...base, neighborhood: bairro }).decision, "approved");
  });
});

describe("matchAddress (Google Maps)", () => {
  const city = "Santa Inês";

  it("confirma pelo segmento 'Cidade - UF'", () => {
    assert.equal(matchAddress("R. Tal, 123 - Centro, Santa Inês - MA, 65300-000, Brasil", city, "MA"), "confirmed");
  });

  it("outra cidade ou outra UF é mismatch", () => {
    assert.equal(matchAddress("R. Tal, 123 - Centro, São Luís - MA, 65000-000, Brasil", city, "MA"), "mismatch");
    assert.equal(matchAddress("R. Tal, 123 - Centro, Santa Inês - BA, 45000-000, Brasil", city, "MA"), "mismatch");
  });

  it("endereço vazio é unknown", () => {
    assert.equal(matchAddress("", city, "MA"), "unknown");
    assert.equal(matchAddress(undefined, city, "MA"), "unknown");
  });
});

describe("normalizeUf", () => {
  it("aceita sigla e nome", () => {
    assert.equal(normalizeUf("ma"), "MA");
    assert.equal(normalizeUf("Maranhão"), "MA");
    assert.equal(normalizeUf("maranhao"), "MA");
    assert.equal(normalizeUf("XX"), null);
    assert.equal(normalizeUf(""), null);
  });
});
