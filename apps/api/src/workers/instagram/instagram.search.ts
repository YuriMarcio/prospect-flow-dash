import axios from "axios";
import { parseInstagramBio } from "./instagram.parser";

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------

interface SerpOrganicResult {
  title: string;
  link: string;
  snippet: string;
}

interface SerpResponse {
  organic_results?: SerpOrganicResult[];
  error?: string;
}

export interface InstagramProfile {
  url: string;
  bioSnippet: string;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Gera variações do nome do restaurante para aumentar chance de match.
 * Ex: "Burger House (Delivery)" → ["Burger House", "burger house", "BurgerHouse"]
 */
function sanitizeRestaurantName(rawName: string): string[] {
  const STOP_WORDS = [
    "restaurante", "delivery", "lanches", "pizzaria", "hamburgueria",
    "hamburguer", "bar", "sushi", "doceria", "japa", "japonês",
    "hot dog", "hotdog", "lanchonete", "comida",
  ];

  // Remove texto entre parênteses e após traço
  const cleanName = rawName.replace(/\(.*?\)/g, "").split("-")[0].trim();

  // Remove stop words
  let shortName = cleanName.toLowerCase();
  STOP_WORDS.forEach((word) => {
    shortName = shortName.replace(new RegExp(word, "gi"), "").trim();
  });
  shortName = shortName.replace(/\s+/g, " ").trim();

  // Versão concatenada (ex: "Ladeira 7" → "Ladeira7")
  const concatenated = shortName.replace(/\s+/g, "");

  // Remove variações vazias e duplicadas
  return Array.from(new Set([cleanName, shortName, concatenated])).filter(
    (v) => v.length > 2,
  );
}

/**
 * Verifica se o link é de um perfil do Instagram (não post/reel).
 */
function isInstagramProfile(url: string): boolean {
  if (!url.includes("instagram.com")) return false;
  return !["/p/", "/reel/", "/stories/", "/explore/"].some((p) =>
    url.includes(p),
  );
}

// ---------------------------------------------------------------------------
// FUNÇÃO PRINCIPAL - substitui a versão com Playwright
// ---------------------------------------------------------------------------

/**
 * Busca o perfil do Instagram de um restaurante usando Google Dorking via SerpAPI.
 *
 * Antes: precisava de um browser Playwright aberto → frágil, CAPTCHA, lento.
 * Agora: requisição HTTP pura → sem browser, sem CAPTCHA, 10x mais rápido.
 *
 * Custo: 1 crédito SerpAPI por variação de nome testada.
 * Na prática: 1–3 créditos por restaurante (para na primeira variação que achar).
 */
export async function findInstagramProfile(
  _page: null,                // mantido por compatibilidade — ignorado
  rawName: string,
  city: string,
): Promise<InstagramProfile | null> {
  const SERP_API_KEY = process.env.SERP_API_KEY;

  if (!SERP_API_KEY) {
    console.error("[INSTAGRAM] SERP_API_KEY não configurada. Pulando enriquecimento.");
    return null;
  }

  const nameVariations = sanitizeRestaurantName(rawName);
  console.log(`[INSTAGRAM] Buscando perfil: "${rawName}" | variações: ${nameVariations.join(", ")}`);

  for (const name of nameVariations) {
    const query = `site:instagram.com "${name}" "${city}"`;

    try {
      const response = await axios.get<SerpResponse>("https://serpapi.com/search", {
        params: {
          api_key: SERP_API_KEY,
          engine: "google",
          q: query,
          num: 5,       // só precisamos do primeiro resultado válido
          hl: "pt",
          gl: "br",
        },
      });

      if (response.data.error) {
        console.error(`[INSTAGRAM] SerpAPI erro: ${response.data.error}`);
        return null;
      }

      const results = response.data.organic_results ?? [];

      for (const result of results) {
        if (isInstagramProfile(result.link)) {
          console.log(`[INSTAGRAM] Perfil encontrado: ${result.link}`);
          return {
            url: result.link,
            bioSnippet: result.snippet ?? "",
          };
        }
      }

      // Pausa entre variações para respeitar rate limit
      await new Promise((r) => setTimeout(r, 500));

    } catch (err: any) {
      console.error(
        `[INSTAGRAM] Erro na variação "${name}":`,
        err?.response?.data ?? err?.message,
      );
    }
  }

  console.log(`[INSTAGRAM] Nenhum perfil encontrado para "${rawName}"`);
  return null;
}