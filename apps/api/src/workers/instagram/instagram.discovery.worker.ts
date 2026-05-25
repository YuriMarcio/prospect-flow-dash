import { chromium, Page } from "playwright";
import { parseInstagramBio, ParsedBioData } from "./instagram.parser";
import * as leadsRepository from "../../modules/leads/leads.repository";
// import * as logsRepository from "../../modules/logs/logs.repository";

export interface DiscoveryLead {
  name: string;
  instagram_url: string;
  description: string;
  whatsapp: string | null;
  linktree: string | null;
  digital_menu: string | null;
}

export async function runInstagramDiscovery(
  campaignId: string,
  keyword: string, // Ex: "hamburgueria", "lanches", "delivery"
  city: string,
  quantity: number,
) {
  /*
    =========================================================
    🚀 FUTURA IMPLEMENTAÇÃO: Descoberta Ampla pelo Instagram
    =========================================================
    Este worker servirá para encontrar deliverys e negócios locais
    que operam apenas via Instagram/WhatsApp e NÃO estão no iFood.
  */

  const browser = await chromium.launch({ headless: false }); // Mudar para true em prod
  // newContext() cria uma sessão isolada, equivalente a uma aba anônima/incógnita.
  const context = await browser.newContext();
  const page = await context.newPage();

  const leadsFound: DiscoveryLead[] = [];
  let currentPage = 0;

  try {
    console.log(`[DISCOVERY] Iniciando busca por "${keyword}" em ${city}...`);

    // A string mágica do Google Dorking
    const query = `site:instagram.com "${keyword}" "${city}"`;

    while (leadsFound.length < quantity) {
      // Navegando usando o parâmetro &start= para paginar os resultados do Google (0, 10, 20...)
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${currentPage * 10}`;
      await page.goto(googleUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000); // Pausa para parecer humano

      // Pega todos os blocos de resultado de busca desta página
      const results = await page.locator("#search .g").all();

      if (results.length === 0) {
        console.log(
          "[DISCOVERY] Não há mais resultados no Google. Fim da linha.",
        );
        break;
      }

      for (const result of results) {
        if (leadsFound.length >= quantity) break;

        try {
          const linkElement = result.locator("a").first();
          const url = await linkElement.getAttribute("href");

          // O Google mostra o título assim: "Nome do Restaurante (@nomedoperfil) • Fotos..."
          const titleRaw = await result
            .locator("h3")
            .innerText()
            .catch(() => "");
          const name = titleRaw
            .split("(")[0]
            .trim()
            .replace(" - Instagram", "");

          const snippetText = await result
            .locator(".VwiC3b")
            .innerText()
            .catch(() => "");

          // Só nos interessa se for um link de perfil de verdade, não de postagem /p/ ou /reel/
          if (
            url &&
            url.includes("instagram.com") &&
            !url.includes("/p/") &&
            !url.includes("/reel/")
          ) {
            // Usamos o nosso parser maravilhoso que criamos antes!
            const parsedBio = parseInstagramBio(snippetText);

            const lead: DiscoveryLead = {
              name: name || "Desconhecido",
              instagram_url: url,
              description: snippetText,
              whatsapp: parsedBio.whatsapp,
              linktree: parsedBio.linktree,
              digital_menu: parsedBio.digitalMenu,
            };

            leadsFound.push(lead);
            console.log(
              `[DISCOVERY] Novo lead capturado: ${lead.name} | WA: ${lead.whatsapp || "N/A"}`,
            );

            const result = await leadsRepository.createUnique({
              campaign_id: campaignId,
              ...lead,
            });
            if (!result.created) {
              console.log(`[DISCOVERY] Lead repetido ignorado: ${lead.name}`);
            }
          }
        } catch (err) {
          // Ignora erro em um bloco específico e continua
        }
      }

      currentPage++;
    }
  } catch (error) {
    console.error(`[DISCOVERY] Falha crítica no worker de descoberta:`, error);
  } finally {
    await browser.close();
    console.log(
      `[DISCOVERY] Processo finalizado. Total capturado: ${leadsFound.length}`,
    );
  }
}
