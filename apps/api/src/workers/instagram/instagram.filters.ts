import { normalizeLoose } from "../../lib/text";

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

/** "Burger Kings SLZ (@burgerkingsslz) • Fotos e vídeos do Instagram" → "Burger Kings SLZ" */
export function extractNameFromTitle(title: string): string {
  return title
    .split("(")[0]
    .replace("- Instagram", "")
    .replace("| Instagram", "")
    .trim();
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

export interface DiscoveryStrategy {
  id: "category" | "synonyms" | "delivery" | "geo" | "whatsapp";
  query: string;
}

const quote = (phrase: string) => `"${phrase}"`;
const anyOf = (phrases: string[]) =>
  phrases.length > 1 ? `(${phrases.map(quote).join(" OR ")})` : quote(phrases[0]);

/** Sinônimos de busca da categoria (burger/burguer/hambúrguer para "Hamburgueria"), sem repetir a própria categoria. */
function synonymsFor(alternatives: string[]): string[] {
  const own = new Set(alternatives.map(normalizeLoose));
  const found = new Set<string>();

  for (const alternative of alternatives.map(normalizeLoose)) {
    for (const family of NICHE_FAMILIES) {
      if (!family.keys.some((key) => alternative.includes(key))) continue;
      family.queryTerms.filter((term) => !own.has(normalizeLoose(term))).forEach((term) => found.add(term));
    }
  }
  return [...found];
}

/**
 * Estratégias de busca: cada uma explora uma forma diferente de o negócio se apresentar no
 * Instagram. São hipóteses: o orquestrador mede quantos candidatos cada uma produz e só
 * aprofunda as que rendem.
 */
export function buildInstagramStrategies(keyword: string, city: string, state?: string | null): DiscoveryStrategy[] {
  const alternatives = parseKeyword(keyword);
  const synonyms = synonymsFor(alternatives);
  const place = quote(city.replace(/"/g, "").trim());
  const uf = state?.trim().toUpperCase();

  const strategies: DiscoveryStrategy[] = [
    { id: "category", query: `site:instagram.com ${anyOf(alternatives)} ${place}` },
  ];

  if (synonyms.length > 0) {
    strategies.push({ id: "synonyms", query: `site:instagram.com ${anyOf(synonyms)} ${place}` });
  }

  strategies.push({ id: "delivery", query: `site:instagram.com ${quote("delivery")} ${anyOf(alternatives)} ${place}` });

  strategies.push(
    uf
      ? { id: "geo", query: `site:instagram.com ${anyOf([...alternatives, ...synonyms])} ${place} ${quote(uf)}` }
      : { id: "whatsapp", query: `site:instagram.com ${anyOf(alternatives)} ${place} ${quote("whatsapp")}` },
  );

  const seen = new Set<string>();
  return strategies.filter(({ query }) => !seen.has(query) && seen.add(query));
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
const NICHE_FAMILIES: Array<{ keys: string[]; terms: string[]; queryTerms: string[] }> = [
  {
    keys: ["hamburg", "burger", "burguer"],
    terms: ["hamburg", "burger", "burguer", "smash"],
    queryTerms: ["burger", "burguer", "hambúrguer", "hamburguer"],
  },
  {
    keys: ["sushi", "japon", "temak"],
    terms: ["sushi", "japon", "temaki", "sashimi", "nikkei"],
    queryTerms: ["sushi", "japonês", "temaki"],
  },
  {
    keys: ["hot dog", "hotdog"],
    terms: ["hot dog", "hotdog", "cachorro quente", "dogao"],
    queryTerms: ["hot dog", "hotdog", "cachorro quente"],
  },
  { keys: ["cafeteria", "cafe"], terms: ["cafe", "cafeteria", "coffee"], queryTerms: ["café", "cafeteria", "coffee"] },
  { keys: ["lanchonete"], terms: ["lanch"], queryTerms: ["lanches", "lanchonete"] },
  {
    keys: ["arabe"],
    terms: ["arabe", "esfiha", "kibe", "shawarma"],
    queryTerms: ["árabe", "esfiha", "kibe", "shawarma"],
  },
];

/**
 * confirmed = o texto menciona a categoria (ou um sinônimo dela).
 * unknown   = não menciona. Não é prova de que é outro nicho, só falta de evidência.
 */
export type NicheEvidence = "confirmed" | "unknown";

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
 * Cria o classificador "esse resultado é do nicho buscado?" a partir da categoria.
 *
 * Recebe os textos disponíveis do resultado (título, snippet, handle; no Maps, também o tipo do
 * estabelecimento). O handle entra porque salva casos como "brasaburguersbu", em que o título
 * usa fonte estilizada ("Bʀᴀꜱᴀ Bᴜʀɢᴜᴇʀ") que a normalização Unicode não converte.
 */
export function buildNicheMatcher(keyword: string): (texts: string[]) => NicheEvidence {
  const anyTerms = new Set<string>();
  const allGroups: string[][] = [];

  for (const alternative of parseKeyword(keyword).map(normalizeLoose)) {
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
  if (anyTerms.size === 0 && allGroups.length === 0) return () => "confirmed";

  return (texts) => {
    const haystack = normalizeLoose(texts.filter(Boolean).join(" "));
    if ([...anyTerms].some((term) => containsTerm(haystack, term))) return "confirmed";
    return allGroups.some((group) => group.every((term) => containsTerm(haystack, term)))
      ? "confirmed"
      : "unknown";
  };
}
