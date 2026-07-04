import { chromium, BrowserContext } from "playwright";
import * as campaignsRepository from "../../modules/campaigns/campaigns.repository";
import * as leadsRepository from "../../modules/leads/leads.repository";
import * as logsRepository from "../../modules/logs/logs.repository";
import { isCancelled, cleanup } from "../../lib/cancellation";

function toSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function parseWhatsApp(href: string): string | null {
  const match = href.match(/wa\.me\/(\d+)/);
  return match ? match[1] : null;
}

function parseInstagramUrl(raw: string): string | null {
  let decode = raw;

  // Google redirect: /url?q=... ou https://www.google.com/url?q=...
  if (raw.includes("google.com/url") || raw.startsWith("/url?")) {
    decode = decodeURIComponent(raw.match(/[?&]q=([^&]+)/)?.[1] ?? "");
  }

  // DuckDuckGo redirect: //duckduckgo.com/l/?uddg=...
  if (raw.includes("duckduckgo.com/l/") || raw.startsWith("//duckduckgo.com")) {
    decode = decodeURIComponent(raw.match(/[?&]uddg=([^&]+)/)?.[1] ?? "");
  }

  const match = decode.match(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)\/?/);
  if (!match) return null;

  const username = match[1];
  const invalid = ["p", "reel", "reels", "stories", "explore", "accounts", "tv", "s", "web"];
  if (invalid.includes(username)) return null;

  return `https://www.instagram.com/${username}/`;
}

async function searchInstagram(
  context: BrowserContext,
  query: string,
): Promise<string | null> {
  // DuckDuckGo HTML: sem JavaScript, sem consent, sem bot detection
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const page = await context.newPage();

  try {
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 15000 });

    // Aguarda pelo menos um resultado aparecer
    await page.waitForSelector(".result__a, .result__url", { timeout: 6000 }).catch(() => {});

    const hrefs = await page.$$eval("a[href]", (as) =>
      (as as HTMLAnchorElement[])
        .map((a) => a.getAttribute("href") ?? "")
        .filter((h) => h.includes("instagram.com") || h.includes("uddg=")),
    );

    await page.close();

    for (const href of hrefs) {
      const url = parseInstagramUrl(href);
      if (url) return url;
    }
  } catch {
    await page.close().catch(() => {});
  }

  return null;
}

async function findInstagramViaGoogle(
  context: BrowserContext,
  storeName: string,
  cityName: string,
): Promise<string | null> {
  // Tenta com cidade; fallback sem cidade se não achar
  const queries = [
    `site:instagram.com "${storeName}" "${cityName}"`,
    `site:instagram.com "${storeName}"`,
  ];

  for (const query of queries) {
    const result = await searchInstagram(context, query);
    if (result) return result;
  }

  return null;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runInstaDeliveryScraping(
  campaignId: string,
  cityName: string,
  quantity: number,
) {
  const citySlug = toSlug(cityName);

  await campaignsRepository.updateStatus(campaignId, "running");
  await logsRepository.create(
    campaignId,
    `Iniciando scraping InstaDelivery para ${cityName} (${citySlug})`,
    "info",
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  try {
    // ── 1. Coletar lista de lojas com scroll infinito ─────────────────────────
    const listPage = await context.newPage();

    try {
      await listPage.goto(
        `https://portal.instadelivery.com.br/${citySlug}`,
        { waitUntil: "networkidle", timeout: 25000 },
      );
    } catch {
      // networkidle pode dar timeout em páginas pesadas — tenta continuar mesmo assim
    }

    try {
      await listPage.waitForSelector(".food-menu-content", { timeout: 15000 });
    } catch {
      await logsRepository.create(
        campaignId,
        `Nenhuma loja encontrada para "${cityName}". A cidade pode não estar no portal.`,
        "warn",
      );
      await campaignsRepository.updateStatus(campaignId, "done");
      await browser.close();
      return;
    }

    // Scroll infinito: rola até o conteúdo estabilizar por 3 rounds consecutivos
    let previousCount = 0;
    let stableRounds = 0;

    while (stableRounds < 3) {
      await listPage.evaluate(() =>
        window.scrollTo(0, document.body.scrollHeight),
      );
      await delay(1500);

      const currentCount = await listPage.$$eval(
        ".food-menu-content",
        (els) => els.length,
      );

      if (currentCount === previousCount) {
        stableRounds++;
      } else {
        stableRounds = 0;
        previousCount = currentCount;
      }
    }

    const stores: { name: string; url: string }[] = await listPage.$$eval(
      ".food-menu-content",
      (divs) =>
        divs.map((div) => {
          const anchor = div.querySelector("a[href]");
          return {
            name: div.querySelector("h4.title")?.textContent?.trim() ?? "",
            url: anchor?.getAttribute("href") ?? "",
          };
        }),
    );

    await listPage.close();

    const validStores = stores.filter((s) => s.name && s.url);

    await logsRepository.create(
      campaignId,
      `Encontradas ${validStores.length} lojas. Processando até ${quantity}...`,
      "info",
    );

    // ── 2. Para cada loja, extrair WhatsApp ───────────────────────────────────
    const limit = Math.min(validStores.length, quantity);
    let processed = 0;
    let found = 0;

    for (const store of validStores.slice(0, limit)) {
      if (isCancelled(campaignId)) break;
      processed++;
      try {
        // Verifica duplicata pelo nome+cidade antes de acessar a página (evita visitas desnecessárias)
        const alreadyExists = await leadsRepository.existsByNameAndCity(store.name, cityName);
        if (alreadyExists) {
          await logsRepository.create(
            campaignId,
            `[${processed}/${limit}] ${store.name} | PULANDO (já existe no banco)`,
            "info",
          );
          await campaignsRepository.updateStats(campaignId, { processed, found });
          continue;
        }

        const storePage = await context.newPage();

        try {
          await storePage.goto(store.url, {
            waitUntil: "networkidle",
            timeout: 15000,
          });
        } catch {
          // continua mesmo com timeout de networkidle
        }

        const waHref = await storePage
          .$eval('a[href*="wa.me/"]', (a) => a.getAttribute("href") ?? "")
          .catch(() => "");

        await storePage.close();

        const whatsapp = waHref ? parseWhatsApp(waHref) : null;

        // Busca Instagram via Google (sem acessar o perfil, só coleta o link)
        const instagramUrl = await findInstagramViaGoogle(context, store.name, cityName);

        const { created } = await leadsRepository.createUnique({
          campaign_id: campaignId,
          name: store.name,
          whatsapp: whatsapp ?? undefined,
          instagram_url: instagramUrl ?? undefined,
          city: cityName,
          category: "Delivery",
          source: "instadelivery",
          delivery_link: store.url,
        });

        if (created) found++;

        await logsRepository.create(
          campaignId,
          `[${processed}/${limit}] ${store.name} | WA: ${whatsapp ?? "—"} | IG: ${instagramUrl ? "@" + instagramUrl.split("/").filter(Boolean).pop() : "—"} | ${created ? "SALVO" : "DUPLICADO"}`,
          "info",
        );

        await campaignsRepository.updateStats(campaignId, { processed, found });
        await delay(800);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        await logsRepository.create(
          campaignId,
          `Erro em "${store.name}": ${message}`,
          "warn",
        );
        await campaignsRepository.updateStats(campaignId, { processed, found });
      }
    }

    const wasCancelled = isCancelled(campaignId);
    cleanup(campaignId);

    if (wasCancelled) {
      await logsRepository.create(
        campaignId,
        `Captura interrompida. ${found} leads salvos de ${processed} processados.`,
        "warn",
      );
    } else {
      await campaignsRepository.updateStatus(campaignId, "done");
      await logsRepository.create(
        campaignId,
        `Campanha finalizada. ${found} leads salvos de ${processed} processados.`,
        "info",
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await logsRepository.create(campaignId, `Erro crítico: ${message}`, "error");
    await campaignsRepository.updateStatus(campaignId, "error");
  } finally {
    await browser.close();
  }
}
