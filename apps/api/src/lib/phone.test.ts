import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyBrazilPhone, nationalDigits } from "./phone";

describe("classifyBrazilPhone", () => {
  it("celular é candidato a WhatsApp", () => {
    assert.deepEqual(classifyBrazilPhone("(98) 98888-7777"), { e164: "+5598988887777", kind: "mobile" });
    assert.deepEqual(classifyBrazilPhone("+55 98 98888-7777"), { e164: "+5598988887777", kind: "mobile" });
  });

  it("fixo não é WhatsApp", () => {
    assert.equal(classifyBrazilPhone("(98) 3333-4444")?.kind, "landline");
    assert.equal(classifyBrazilPhone("+551123611422")?.kind, "landline");
  });

  it("número inválido ou estrangeiro vira null", () => {
    assert.equal(classifyBrazilPhone("78974341"), null);
    assert.equal(classifyBrazilPhone(""), null);
    assert.equal(classifyBrazilPhone("+1 202 555 0143"), null);
  });
});

describe("nationalDigits", () => {
  it("tira o DDI para comparar número antigo (sem 55) com E.164", () => {
    assert.equal(nationalDigits("+5598988887777"), "98988887777");
    assert.equal(nationalDigits("98988887777"), "98988887777");
  });
});
