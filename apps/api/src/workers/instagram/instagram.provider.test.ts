import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { profileToLeadFields, providerRejection } from "./instagram.profile";
import { apifyItemToProfile, fetchApifyProfile, resolveProfileProvider } from "./instagram.provider";

describe("resolveProfileProvider", () => {
  it("sem nenhuma chave não há provedor", () => {
    assert.equal(resolveProfileProvider({}), null);
  });

  it("usa o que tiver chave", () => {
    assert.equal(resolveProfileProvider({ APIFY_TOKEN: "x" }), "apify");
    assert.equal(resolveProfileProvider({ SCRAPECREATORS_API_KEY: "x" }), "scrapecreators");
  });

  it("com as duas chaves, o Apify vence: os créditos grátis do ScrapeCreators não renovam", () => {
    assert.equal(resolveProfileProvider({ APIFY_TOKEN: "x", SCRAPECREATORS_API_KEY: "y" }), "apify");
  });

  it("PROFILE_PROVIDER força a escolha; valor desconhecido é ignorado", () => {
    const both = { APIFY_TOKEN: "x", SCRAPECREATORS_API_KEY: "y" };
    assert.equal(resolveProfileProvider({ ...both, PROFILE_PROVIDER: "ScrapeCreators" }), "scrapecreators");
    assert.equal(resolveProfileProvider({ ...both, PROFILE_PROVIDER: "outro" }), "apify");
  });
});

describe("apifyItemToProfile", () => {
  const item = {
    username: "zelandiaburger",
    fullName: "Zelândia Burger",
    biography: "Hambúrguer artesanal em Santa Inês/MA 🍔",
    externalUrl: "https://linktr.ee/zelandia",
    externalUrls: [
      { title: "Pedidos", url: "https://wa.me/5598988887777", lynx_url: "https://l.instagram.com/?u=x", link_type: "external" },
      { title: "Links", url: "https://linktr.ee/zelandia" },
    ],
    followersCount: 1234,
  };

  it("converte para o formato do LeadFlow e junta os links da bio sem repetir", () => {
    const profile = apifyItemToProfile(item);

    assert.equal(profile?.username, "zelandiaburger");
    assert.equal(profile?.full_name, "Zelândia Burger");
    assert.equal(profile?.follower_count, 1234);
    assert.equal(profile?.external_url, "https://linktr.ee/zelandia");
    assert.deepEqual(profile?.bio_links, [{ url: "https://wa.me/5598988887777" }, { url: "https://linktr.ee/zelandia" }]);
  });

  it("o WhatsApp do link da bio chega ao lead", () => {
    const fields = profileToLeadFields(apifyItemToProfile(item)!);

    assert.equal(fields.whatsapp, "+5598988887777");
    assert.equal(fields.linktree, "https://linktr.ee/zelandia");
    assert.equal(fields.followers, 1234);
  });

  it("sem links na bio, os campos ficam vazios mas o perfil existe", () => {
    const profile = apifyItemToProfile({ username: "semlink", biography: "só texto (98) 98888-7777" });

    assert.deepEqual(profile?.bio_links, []);
    assert.equal(profile?.external_url, null);
    assert.equal(profileToLeadFields(profile!).whatsapp, "+5598988887777");
  });

  it("perfil não encontrado ou item de erro vira null", () => {
    assert.equal(apifyItemToProfile(null), null);
    assert.equal(apifyItemToProfile({}), null);
    assert.equal(apifyItemToProfile({ error: "not_found", errorDescription: "Page not found" }), null);
  });
});

describe("fetchApifyProfile", () => {
  it("chama o actor de forma síncrona com o token no cabeçalho e o @ em `usernames`", async () => {
    const calls: Array<{ url: string; body: unknown; headers?: Record<string, string> }> = [];
    const post = async (url: string, body: unknown, config?: { headers?: Record<string, string> }) => {
      calls.push({ url, body, headers: config?.headers });
      return { data: [{ username: "zelandiaburger", biography: "oi" }] as never };
    };

    const profile = await fetchApifyProfile("zelandiaburger", "tok123", post as never);

    assert.equal(profile?.username, "zelandiaburger");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /apify~instagram-profile-scraper\/run-sync-get-dataset-items$/);
    assert.deepEqual(calls[0].body, { usernames: ["zelandiaburger"] });
    assert.equal(calls[0].headers?.Authorization, "Bearer tok123");
    assert.equal(calls[0].url.includes("tok123"), false, "o token não vai na URL (apareceria em logs)");
  });

  it("dataset vazio é perfil não encontrado", async () => {
    const post = async () => ({ data: [] as never });
    assert.equal(await fetchApifyProfile("fantasma", "tok", post as never), null);
  });

  it("402 (limite de uso do Apify) sobe como recusa do provedor", async () => {
    const refused = Object.assign(new Error("Request failed with status code 402"), { response: { status: 402 } });
    const post = async () => {
      throw refused;
    };

    await assert.rejects(fetchApifyProfile("x", "tok", post as never), (err) => providerRejection(err) === 402);
  });
});
