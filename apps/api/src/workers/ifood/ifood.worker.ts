import { chromium, Page } from "playwright";
import { findInstagramProfile } from "../instagram/instagram.search";
import { parseInstagramBio } from "../instagram/instagram.parser";
import { LeadDataType } from "@leadflow/types";
import { enrichWithCNPJ } from "../enrichment/casasdados.worker";

export async function runIfoodScraping(
  campaignId: string,
  address: string,
  category: string,
  quantity: number
) {
  // Iniciando o browser (coloque headless: true em produção)
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`[WORKER] Iniciando campanha ${campaignId}`);

    // 1. Acessar o iFood
    await page.goto("https://www.ifood.com.br/", { waitUntil: "networkidle" });

    // 2. Inserir o Endereço
    await setupAddress(page, address);

    // 3. Selecionar a Categoria
    await selectCategory(page, category);

    // 4. Coletar os links dos restaurantes (até atingir a 'quantity')
    const restaurantLinks = await collectRestaurantLinks(page, quantity);
    console.log(`[WORKER] Encontrados ${restaurantLinks.length} restaurantes para extração.`);

    // 5. Iterar sobre cada restaurante e extrair os dados
   for (const link of restaurantLinks) {
      // Deixamos apenas UMA chamada aqui:
      const leadData = await extractRestaurantData(page, link);

      if (leadData) {
        // 1. Vai pro Google procurar o Instagram usando a mesma página do Playwright
        const instaResult = await findInstagramProfile(page, leadData.name, leadData.address); // Pegar a cidade da campanha

        if (instaResult) {
          leadData.instagram_url = instaResult.url;

          // 2. Passa a Bio no pente fino das Regex
          const parsedBio = parseInstagramBio(instaResult.bioSnippet);

          leadData.whatsapp = parsedBio.whatsapp;
          leadData.linktree = parsedBio.linktree;
          leadData.digital_menu = parsedBio.digitalMenu;
        }

        if (leadData.cnpj && leadData.cnpj !== "Não informado") {
          const fiscalData = await enrichWithCNPJ(leadData.cnpj);
          
          if (fiscalData) {
            // Mesclamos os dados fiscais dentro do nosso lead principal
            leadData.company_name = fiscalData.company_name;
            leadData.partners = fiscalData.partners;
            leadData.fiscal_phones = fiscalData.fiscal_phones;
            leadData.fiscal_emails = fiscalData.fiscal_emails;
          }
        }

        console.log("LEAD ENRIQUECIDO ATÉ AGORA:", leadData);
      }
    }

  } catch (error) {
    console.error(`[WORKER] Erro crítico no scraping:`, error);
  } finally {
    await browser.close();
    console.log(`[WORKER] Campanha ${campaignId} finalizada.`);
  }
}

// --- FUNÇÕES ESPECIALISTAS ---

async function setupAddress(page: Page, address: string) {
  console.log(`[WORKER] Configurando endereço: ${address}`);

  // Clica no input inicial
  await page.locator(".delivery-input").click();

  // Aguarda o modal abrir
  await page.waitForSelector(".marmita-modal__inner-content-scroll");

  // Digita o endereço (o iFood usa um input dentro do modal antes do botão)
  // O seletor exato do input de texto pode variar, mas geralmente interceptamos o foco
  await page.locator("input.address-search-input").fill(address);

  // Aguarda a lista de resultados carregar e clica no primeiro
  await page.waitForSelector(".btn-address--full-size");
  await page.locator(".btn-address--full-size").first().click();

  // Aguarda a página recarregar com o novo endereço
  await page.waitForLoadState("networkidle");
}

async function selectCategory(page: Page, category: string) {
  console.log(`[WORKER] Buscando categoria: ${category}`);

  // Procura o carrossel de categorias
  const categorySelector = `.small-banner-item__title:has-text("${category}")`;

  // Verifica se a categoria existe na tela
  await page.waitForSelector(categorySelector, { timeout: 5000 }).catch(() => {
    throw new Error(`Categoria '${category}' não encontrada na tela inicial.`);
  });

  await page.locator(categorySelector).click();
  await page.waitForLoadState("networkidle");
}

async function collectRestaurantLinks(page: Page, quantity: number): Promise<string[]> {
  console.log(`[WORKER] Coletando restaurantes...`);

  const links = new Set<string>();

  // Loop de scroll para carregar a lista até atingir a quantidade desejada
  while (links.size < quantity) {
    await page.waitForSelector(".merchant-list-v2__wrapper");

    // Pega todos os cards carregados (eles são tags <a> no iFood)
    const cards = await page.locator(".merchant-list-v2__item-wrapper").all();

    for (const card of cards) {
      const href = await card.getAttribute("href");
      if (href) links.add(`https://www.ifood.com.br${href}`);
      if (links.size >= quantity) break;
    }

    if (links.size >= quantity) break;

    // Scrolla para o fim da página para forçar o lazy load do iFood
    await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
    await page.waitForTimeout(2000); // Espera o request da nova página
  }

  return Array.from(links);
}

async function extractRestaurantData(page: Page, url: string): Promise<LeadDataType | null> {
  console.log(`[WORKER] Extraindo dados de: ${url}`);

  // Acessa a página do restaurante direto pela URL coletada
  await page.goto(url, { waitUntil: "networkidle" });

  try {
    // Pega o nome do restaurante
    const name = await page.locator(".merchant-info__title").innerText();

    // Clica no botão "Ver mais"
    await page.locator(".merchant-info__detail-container .merchant-details__button").click();

    // Aguarda o modal de "Sobre" abrir
    await page.waitForSelector(".merchant-details-about");

    // Extrai a descrição
    const description = await page.locator(".merchant-details-about__description").innerText().catch(() => "");

    // Extrai o CNPJ (buscando o texto exato usando o HTML que você enviou)
    let cnpj = "Não informado";
    const cnpjElement = page.locator(".merchant-details-about__info-data", { hasText: "CNPJ:" });
    if (await cnpjElement.count() > 0) {
      const cnpjRaw = await cnpjElement.first().innerText();
      cnpj = cnpjRaw.replace("CNPJ:", "").trim(); // Limpa a string deixando só os números
    }

    // Extrai o Endereço completo (Iterando pelos parágrafos de endereço)
    let address = "";
    const addressContainer = page.locator(".merchant-details-about__info").filter({ hasText: "Endereço" });
    if (await addressContainer.count() > 0) {
      // Pega todos os <p> dentro do container de endereço, exceto o título
      const addressLines = await addressContainer.locator(".merchant-details-about__info-data").allInnerTexts();
      address = addressLines.join(", ");
    }

    const leadData = {
      name,
      description,
      cnpj,
      address,
      ifood_url: url
    };

    console.log(`[WORKER] Lead extraído com sucesso:`, leadData);
    return leadData;

  } catch (error) {
    console.error(`[WORKER] Falha ao extrair dados do restaurante ${url}`, error);
    return null;
  }
}