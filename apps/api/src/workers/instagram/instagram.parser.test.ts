import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractWhatsappFromBio, parseInstagramBio } from "./instagram.parser";

describe("telefone da bio", () => {
  it("número sem DDD (lead #37 do log) não vira WhatsApp", () => {
    assert.equal(parseInstagramBio("Isaac Wa Norman Shaaka 78974341").whatsapp, null);
    assert.equal(extractWhatsappFromBio("contato 78974341", []), null);
  });

  it("wa.me inválido é descartado em vez de gravado cru", () => {
    assert.equal(parseInstagramBio("wa.me/12345").whatsapp, null);
    assert.equal(extractWhatsappFromBio("", [{ url: "https://wa.me/12345" }]), null);
  });

  it("celular sem DDD (caso real: 'Delivery 99964-3585') não vira um +55 de 9 dígitos", () => {
    const bio = "🍔Melhores Lanches-ilha do governador/Rj🍔 🛵Delivery 99964-3585";
    assert.equal(parseInstagramBio(bio).whatsapp, null);
    assert.equal(extractWhatsappFromBio(bio, []), null);
  });

  it("o mesmo celular com DDD continua valendo", () => {
    assert.equal(extractWhatsappFromBio("🛵Delivery (21) 99964-3585", []), "+5521999643585");
    assert.equal(parseInstagramBio("Delivery 21 99964-3585").whatsapp, "+5521999643585");
  });

  it("wa.me e telefone brasileiro válidos viram E.164", () => {
    assert.equal(parseInstagramBio("pedidos wa.me/5598988887777").whatsapp, "+5598988887777");
    assert.equal(extractWhatsappFromBio("Pedidos (98) 98888-7777", []), "+5598988887777");
  });
});
