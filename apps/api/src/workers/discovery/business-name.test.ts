import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { distinctiveTokens, handleAsName, sameBusiness } from "./business-name";

const city = "Santa Inês";

describe("sameBusiness", () => {
  it("reconhece o mesmo negócio apesar de genéricos, cidade e acento", () => {
    assert.equal(sameBusiness("Zelândia Burger", "Zelandia Hamburgueria Santa Ines", city), true);
    assert.equal(sameBusiness("Sr. Honório Hambúrgueria", "Sr Honorio", city), true);
  });

  it("negócios diferentes não se juntam", () => {
    assert.equal(sameBusiness("Burger King", "King Pizza", city), false);
    assert.equal(sameBusiness("Zelândia Burger", "Atlântida Burger", city), false);
  });

  it("nome só com palavras genéricas nunca casa", () => {
    assert.equal(sameBusiness("Hamburgueria Delivery", "Hamburgueria Delivery", city), false);
  });

  it("contido só vale com 2+ palavras distintivas", () => {
    assert.equal(sameBusiness("Bela Brasa", "Bela Brasa Costelaria", city), true);
    assert.equal(sameBusiness("Brasa", "Bela Brasa Costelaria", city), false);
  });
});

describe("helpers", () => {
  it("handleAsName e distinctiveTokens", () => {
    assert.equal(handleAsName("one.hamburgueria_sp2"), "one hamburgueria sp");
    assert.deepEqual(distinctiveTokens("Gabs Burguer • Hamburgueria", city), ["gabs"]);
  });
});
