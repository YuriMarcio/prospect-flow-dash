import { Page } from "playwright";

// Função auxiliar para criar as variações do nome
function sanitizeRestaurantName(rawName: string): string[] {
  // 1. Remove tudo entre parênteses e traços (ex: "Sushi Japa (Entrega Grátis)" -> "Sushi Japa")
  const cleanName = rawName.replace(/\(.*?\)/g, "").split("-")[0].trim();

  // 2. Remove "Stop Words"
  const stopWords = ["restaurante", "delivery", "lanches", "pizzaria", "hamburgueria", "bar", "sushi", "doceria"];
  let shortestName = cleanName.toLowerCase();
  stopWords.forEach((word) => {
    shortestName = shortestName.replace(word, "").trim();
  });

  // 3. Versão tudo junto (ex: "Ladeira 7" -> "Ladeira7")
  const concatenatedName = shortestName.replace(/\s+/g, "");

  // Retorna um Set convertido em Array para evitar variações repetidas
  return Array.from(new Set([cleanName, shortestName, concatenatedName])).filter(Boolean);
}

export async function findInstagramProfile(page: Page, rawName: string, city: string) {
  const nameVariations = sanitizeRestaurantName(rawName);
  console.log(`[INSTAGRAM] Buscando perfil para: ${rawName}. Variações:`, nameVariations);

  for (const name of nameVariations) {
    const query = `site:instagram.com "${name}" "${city}"`;
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    await page.goto(googleUrl, { waitUntil: "domcontentloaded" });

    // Espera um pouco para parecer humano e não tomar Captcha do Google
    await page.waitForTimeout(1500);

    try {
      // Pega o primeiro resultado de busca
      const firstResult = page.locator("#search .g").first();
      
      if (await firstResult.count() > 0) {
        // Extrai o link (URL)
        const linkElement = firstResult.locator("a").first();
        const url = await linkElement.getAttribute("href");

        // Extrai o texto do snippet (A descrição que o Google mostra, que geralmente contém a Bio do Insta)
        const snippetText = await firstResult.locator(".VwiC3b").innerText().catch(() => "");

        if (url && url.includes("instagram.com")) {
          console.log(`[INSTAGRAM] Perfil encontrado! URL: ${url}`);
          return { url, bioSnippet: snippetText };
        }
      }
    } catch (error) {
      console.error(`[INSTAGRAM] Erro ao analisar resultados do Google para ${name}`, error);
    }
  }

  console.log(`[INSTAGRAM] Nenhum perfil encontrado para ${rawName}`);
  return null; // Retorna null se falhou em todas as tentativas
}