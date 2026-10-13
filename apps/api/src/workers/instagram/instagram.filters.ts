import { normalizeForMatch } from "../../lib/text";

// ---------------------------------------------------------------------------
// URL DO PERFIL
// ---------------------------------------------------------------------------

const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com"]);

const RESERVED_PATHS = new Set([
  "p", "reel", "reels", "stories", "explore", "accounts", "tv", "direct",
  "about", "legal", "developer", "web", "challenge", "directory", "login",
]);

export interface ProfileLink {
  url: string;
  handle: string;
}

/**
 * Devolve a URL canônica do perfil (https://www.instagram.com/<handle>/) ou null
 * quando o link não é um perfil: posts, reels, help.instagram.com,
 * privacycenter.instagram.com etc. O Google mistura tudo isso nos resultados.
 */
export function parseProfileLink(link: string): ProfileLink | null {
  let parsed: URL;
  try {
    parsed = new URL(link);
  } catch {
    return null;
  }

  if (!INSTAGRAM_HOSTS.has(parsed.hostname.toLowerCase())) return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length !== 1) return null;

  const handle = segments[0].toLowerCase();
  if (RESERVED_PATHS.has(handle) || !/^[a-z0-9._]{1,30}$/.test(handle)) return null;

  return { url: `https://www.instagram.com/${handle}/`, handle };
}

// ---------------------------------------------------------------------------
// QUERIES
// ---------------------------------------------------------------------------

/**
 * "Sushi / Japonês" → ["Sushi", "Japonês"]. As categorias do formulário usam "/" para
 * agrupar nomes parecidos; como frase exata ("Sushi / Japonês") o Google quase nunca casa.
 */
export function parseKeyword(keyword: string): string[] {
  const alternatives = keyword
    .split(/[/,]/)
    .map((alt) => alt.replace(/"/g, "").trim())
    .filter(Boolean);

  return alternatives.length > 0 ? alternatives : [keyword.trim()];
}

/** Monta as queries do Google, da mais precisa para a mais ampla. */
export function buildDiscoveryQueries(keyword: string, city: string): string[] {
  const alternatives = parseKeyword(keyword);

  const term = (suffix = "") => {
    const phrases = alternatives.map((alt) => `"${alt}${suffix}"`);
    return phrases.length > 1 ? `(${phrases.join(" OR ")})` : phrases[0];
  };

  return [
    `site:instagram.com ${term()} "${city}"`,
    `site:instagram.com ${term(" delivery")} "${city}"`,
    `site:instagram.com ${term()} "${city}" "whatsapp"`,
  ];
}

// ---------------------------------------------------------------------------
// RELEVÂNCIA DO RESULTADO
// ---------------------------------------------------------------------------

const STOP_TOKENS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "para", "em", "com"]);

/**
 * Categorias em que o Instagram mistura grafias/idiomas (burger × hambúrguer × hamburgueria).
 * Se a categoria contém alguma `keys`, qualquer um dos `terms` já conta como match.
 * Fora dessa tabela vale o fallback genérico: todos os tokens da categoria (com stem simples).
 */
const NICHE_FAMILIES: Array<{ keys: string[]; terms: string[] }> = [
  { keys: ["hamburg", "burger", "burguer"], terms: ["hamburg", "burger", "burguer", "smash"] },
  { keys: ["sushi", "japon", "temak"], terms: ["sushi", "japon", "temaki", "sashimi", "nikkei"] },
  { keys: ["hot dog", "hotdog"], terms: ["hot dog", "hotdog", "cachorro quente", "dogao"] },
  { keys: ["cafeteria", "cafe"], terms: ["cafe", "cafeteria", "coffee"] },
  { keys: ["lanchonete"], terms: ["lanch"] },
  { keys: ["arabe"], terms: ["arabe", "esfiha", "kibe", "shawarma"] },
];

export interface ResultText {
  title: string;
  snippet: string;
  handle: string;
}

/** "Hambúrguer" e a versão em fonte matemática do Instagram ("𝐇𝐚𝐦𝐛𝐮𝐫𝐠𝐮𝐞𝐫") caem no mesmo texto. */
function normalizeText(value: string): string {
  return normalizeForMatch(value.normalize("NFKD"));
}

function stem(token: string): string {
  const stemmed = token.replace(/(aria|eria|ria|s)$/, "");
  return stemmed.length >= 4 ? stemmed : token;
}

/** Termos curtos ("bar", "spa", "pet") só valem como palavra inteira, senão "bar" casaria com "barbearia". */
function containsTerm(haystack: string, term: string): boolean {
  if (term.length >= 4) return haystack.includes(term);
  return new RegExp(`(^|[^a-z0-9])${term}s?([^a-z0-9]|$)`).test(haystack);
}

/**
 * Cria o verificador "esse resultado é do nicho buscado?" a partir da categoria.
 *
 * Olha título + snippet + handle (o handle salva casos como "brasaburguersbu", em que o
 * título usa fonte estilizada). Resultado que não menciona a categoria é descartado —
 * foi assim que apareceram atriz coreana e página de ajuda do Instagram como lead.
 */
export function buildNicheMatcher(keyword: string): (result: ResultText) => boolean {
  const anyTerms = new Set<string>();
  const allGroups: string[][] = [];

  for (const alternative of parseKeyword(keyword).map(normalizeText)) {
    for (const family of NICHE_FAMILIES) {
      if (family.keys.some((key) => alternative.includes(key))) {
        family.terms.forEach((term) => anyTerms.add(term));
      }
    }

    const tokens = alternative
      .split(/[^a-z0-9]+/)
      .filter((token) => token && !STOP_TOKENS.has(token))
      .map(stem);
    if (tokens.length > 0) allGroups.push(tokens);
  }

  // Categoria sem nenhum termo utilizável: melhor não filtrar do que descartar tudo.
  if (anyTerms.size === 0 && allGroups.length === 0) return () => true;

  return ({ title, snippet, handle }) => {
    const haystack = normalizeText(`${title} ${snippet} ${handle}`);
    if ([...anyTerms].some((term) => containsTerm(haystack, term))) return true;
    return allGroups.some((group) => group.every((term) => containsTerm(haystack, term)));
  };
}
