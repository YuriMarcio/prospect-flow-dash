import { normalizeLoose } from "../../lib/text";

// Palavras que aparecem em nomes de negócios de qualquer cidade e não distinguem um do outro.
const GENERIC_TOKENS = new Set([
  "hamburgueria", "hamburguer", "burger", "burguer", "delivery", "restaurante", "lanches", "lanchonete",
  "pizzaria", "pizza", "bar", "oficial", "ltda", "eireli", "me", "epp", "cia", "bbq", "grill", "food",
  "foods", "the", "de", "da", "do", "das", "dos", "e", "em", "oficial", "original",
]);

// Família de categoria das palavras genéricas. Dois nomes que citam categorias diferentes
// ("Burger King" × "King Pizza") não são o mesmo negócio, mesmo que sobre a mesma palavra.
const CATEGORY_FAMILY: Record<string, string> = {
  hamburgueria: "burger", hamburguer: "burger", burger: "burger", burguer: "burger",
  pizzaria: "pizza", pizza: "pizza",
  lanches: "lanche", lanchonete: "lanche",
  bar: "bar",
};

function categoriesOf(name: string): Set<string> {
  const found = normalizeLoose(name).split(/[^a-z0-9]+/).map((token) => CATEGORY_FAMILY[token]);
  return new Set(found.filter((family): family is string => Boolean(family)));
}

/** Palavras que distinguem o negócio: sem genéricas, sem o nome da cidade. */
export function distinctiveTokens(name: string, city: string): string[] {
  const cityTokens = new Set(normalizeLoose(city).split(/[^a-z0-9]+/).filter(Boolean));

  return normalizeLoose(name)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !GENERIC_TOKENS.has(token) && !cityTokens.has(token));
}

/**
 * Os dois nomes são do mesmo negócio? Conservador de propósito: juntar dois negócios diferentes
 * grava dado errado num lead; não juntar só deixa um duplicado, que é barato de resolver.
 * Exige conjuntos de palavras distintivas iguais, ou um contido no outro com ao menos 2 palavras.
 */
export function sameBusiness(a: string, b: string, city: string): boolean {
  const left = distinctiveTokens(a, city);
  const right = distinctiveTokens(b, city);
  if (left.length === 0 || right.length === 0) return false;

  const categoriesA = categoriesOf(a);
  const categoriesB = categoriesOf(b);
  if (categoriesA.size > 0 && categoriesB.size > 0 && ![...categoriesA].some((family) => categoriesB.has(family))) {
    return false;
  }

  const [small, large] = left.length <= right.length ? [left, right] : [right, left];
  if (!small.every((token) => large.includes(token))) return false;
  return small.length === large.length || small.length >= 2;
}

/** "one.hamburgueria" → "one hamburgueria", para comparar o @ com o nome do negócio. */
export function handleAsName(handle: string): string {
  return handle.replace(/[._]+/g, " ").replace(/\d+/g, " ").trim();
}
