import { foldDiacritics, normalizeLoose } from "../../lib/text";

/**
 * confirmed = há evidência de que o estabelecimento é da cidade buscada.
 * mismatch  = há evidência CONTRÁRIA (outra cidade/UF). Só isso justifica descartar.
 * unknown   = nenhuma evidência. Ausência de menção à cidade não é prova de que ela está errada.
 */
export type LocationEvidence = "confirmed" | "unknown" | "mismatch";

export const UF_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
  MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará",
  PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
  SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

const UF_BY_NAME = new Map(Object.entries(UF_NAMES).map(([uf, name]) => [normalizeLoose(name), uf]));

/** "ma", "MA", "Maranhão" → "MA". Qualquer outra coisa → null. */
export function normalizeUf(input?: string | null): string | null {
  const value = input?.trim();
  if (!value) return null;
  const upper = value.toUpperCase();
  if (UF_NAMES[upper]) return upper;
  return UF_BY_NAME.get(normalizeLoose(value)) ?? null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cityPattern(city: string): RegExp {
  const words = normalizeLoose(city).split(/\s+/).filter(Boolean).map(escapeRegExp);
  return new RegExp(`(?<![a-z0-9])${words.join("\\s+")}(?![a-z0-9])`, "g");
}

// "Cidade - UF", "Cidade/UF", "Cidade, UF". A UF precisa estar em MAIÚSCULAS: sem isso,
// "publicações - Se você" seria lido como Sergipe.
const CITY_UF_PAIR = /([A-Za-z]{3,}(?:\s+[A-Za-z]{2,}){0,3})\s*[-–/,]\s*([A-Z]{2})(?![A-Za-z])/g;
const UF_AFTER_CITY = /^\s*[-–/,]?\s*([A-Za-z]{2})(?![A-Za-z])/;

/**
 * Cidade em texto livre (título, snippet, bio do Instagram).
 *
 * - cidade citada, sem UF colada → confirmed (com a UF colada igual à buscada também);
 * - cidade citada com OUTRA UF colada ("Santa Inês - BA") → mismatch: existem várias Santa Inês;
 * - cidade não citada, mas há "OutraCidade - UF" com UF diferente da buscada → mismatch;
 * - o resto → unknown. DDD de telefone nunca entra aqui: não prova a cidade.
 */
export function matchLocation(texts: string[], city: string, state?: string | null): LocationEvidence {
  const targetUf = normalizeUf(state);
  const targetCity = normalizeLoose(city);
  if (!targetCity) return "unknown";

  const folded = foldDiacritics(texts.filter(Boolean).join(" \n "));
  const lower = folded.toLowerCase();

  let mentioned = false;
  let contradicted = false;

  for (const match of lower.matchAll(cityPattern(city))) {
    mentioned = true;
    if (!targetUf) continue;

    const after = folded.slice(match.index + match[0].length).match(UF_AFTER_CITY);
    const code = after?.[1];
    if (!code || !UF_NAMES[code.toUpperCase()]) continue;

    if (code.toUpperCase() === targetUf) return "confirmed";
    if (code === code.toUpperCase()) contradicted = true;
  }

  if (mentioned) return contradicted ? "mismatch" : "confirmed";

  if (targetUf) {
    for (const pair of folded.matchAll(CITY_UF_PAIR)) {
      const [, otherCity, uf] = pair;
      if (UF_NAMES[uf] && uf !== targetUf && normalizeLoose(otherCity) !== targetCity) return "mismatch";
    }
  }

  return "unknown";
}

/**
 * Como matchLocation, mas com bairro/região: perfil do Instagram costuma citar só o bairro
 * ("Ilha do Governador"), não o município. O bairro só confirma quando a cidade não disse nada;
 * se a cidade ou a UF contradizem o texto, continua sendo mismatch.
 */
export function matchArea(
  texts: string[],
  city: string,
  state?: string | null,
  neighborhood?: string | null,
): LocationEvidence {
  const byCity = matchLocation(texts, city, state);
  if (byCity !== "unknown" || !neighborhood?.trim()) return byCity;
  return matchLocation(texts, neighborhood, state) === "confirmed" ? "confirmed" : "unknown";
}

/**
 * Endereço do Google Maps, formato pt-BR: "R. Tal, 123 - Centro, Santa Inês - MA, 65300-000, Brasil".
 * Compara cidade e UF do segmento "Cidade - UF". Sem esse segmento, cai no texto livre.
 */
export function matchAddress(address: string | undefined | null, city: string, state?: string | null): LocationEvidence {
  if (!address?.trim()) return "unknown";

  const targetUf = normalizeUf(state);
  const targetCity = normalizeLoose(city);

  for (const segment of address.split(",").map((part) => part.trim())) {
    const parsed = segment.match(/^(.+?)\s+-\s+([A-Z]{2})$/);
    if (!parsed || !UF_NAMES[parsed[2]]) continue;

    const [, segmentCity, uf] = parsed;
    if (normalizeLoose(segmentCity) !== targetCity) return "mismatch";
    if (targetUf && uf !== targetUf) return "mismatch";
    return "confirmed";
  }

  return matchLocation([address], city, state);
}
