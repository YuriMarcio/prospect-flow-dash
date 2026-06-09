import { parsePhoneNumberFromString } from "libphonenumber-js";

export interface ParsedBioData {
  whatsapp: string | null;
  linktree: string | null;
  digitalMenu: string | null;
}

// ---------------------------------------------------------------------------
// NOVOS UTILITÁRIOS (enriquecimento)
// ---------------------------------------------------------------------------

// Instagram proxifica todos os links bio em https://l.instagram.com/?u=<encoded>
// Esta função extrai o destino real.
function resolveInstagramLink(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "l.instagram.com") {
      const target = parsed.searchParams.get("u");
      if (target) return decodeURIComponent(target);
    }
  } catch {}
  return url;
}

function resolveAll(bioLinks: { url: string }[], externalUrl?: string): string[] {
  return [
    ...(bioLinks ?? []).map((l) => resolveInstagramLink(l.url)),
    externalUrl ? resolveInstagramLink(externalUrl) : "",
  ].filter(Boolean);
}

export function extractUsernameFromUrl(url: string): string | null {
  const match = url.match(/instagram\.com\/([^/?#]+)/);
  if (!match) return null;
  const username = match[1];
  const reserved = ["p", "reel", "stories", "explore", "accounts", "tv", "reels"];
  if (reserved.includes(username)) return null;
  return username || null;
}

function normalizeToE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");

  const withDefault = parsePhoneNumberFromString(digits, "BR");
  if (withDefault?.isValid()) return withDefault.format("E.164");

  const withPlus = parsePhoneNumberFromString(`+${digits}`);
  if (withPlus?.isValid()) return withPlus.format("E.164");

  return null;
}

export function extractWhatsappFromBio(
  biography: string,
  bioLinks: { url: string }[],
  externalUrl?: string,
): string | null {
  for (const link of resolveAll(bioLinks, externalUrl)) {
    const m = link.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)([0-9]+)/);
    if (m) return normalizeToE164(m[1]) ?? m[1];
  }

  if (biography) {
    const waMatch = biography.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)([0-9]+)/);
    if (waMatch) return normalizeToE164(waMatch[1]) ?? waMatch[1];

    const phoneMatch = biography.match(
      /(?:(?:\+|00)?(55)\s?)?(?:\(?([1-9][0-9])\)?\s?)?(?:((?:9\d|[2-9])\d{3})[-\s]?(\d{4}))/,
    );
    if (phoneMatch) {
      const digits = `${phoneMatch[2] ?? ""}${phoneMatch[3]}${phoneMatch[4]}`;
      return normalizeToE164(digits) ?? digits;
    }
  }

  return null;
}

const LINK_IN_BIO_PATTERN = /linktr\.ee|beacons\.ai|linklist\.bio|bio\.link|later\.com\/bio|lnk\.bio/i;
const SKIP_IN_BIO_PATTERN = /wa\.me|whatsapp|ifood\.com\.br|rappi\.com\.br|ubereats\.com|james\.ag|goomer\.app|olaclick\.com|menudino\.com|hubt\.com\.br/i;

export function extractLinktreeFromBio(
  biography: string,
  bioLinks: { url: string }[],
  externalUrl?: string,
): string | null {
  const resolved = resolveAll(bioLinks, externalUrl);

  // 1. Serviço link-in-bio conhecido
  for (const link of resolved) {
    if (LINK_IN_BIO_PATTERN.test(link)) return link.startsWith("http") ? link : `https://${link}`;
  }

  // 2. Qualquer link do bio que não seja WhatsApp nem delivery
  for (const link of resolved) {
    if (!SKIP_IN_BIO_PATTERN.test(link)) return link.startsWith("http") ? link : `https://${link}`;
  }

  // 3. Fallback no texto da bio
  if (biography) {
    const m = biography.match(/linktr\.ee\/[a-zA-Z0-9_.-]+/);
    if (m) return `https://${m[0]}`;
  }

  return null;
}

const DELIVERY_PATTERN =
  /(ifood\.com\.br|rappi\.com\.br|ubereats\.com|james\.ag|goomer\.app|olaclick\.com|menudino\.com|hubt\.com\.br)[^\s"')>]*/i;

export function extractDeliveryLinkFromBio(
  biography: string,
  bioLinks: { url: string }[],
  externalUrl?: string,
): string | null {
  for (const link of resolveAll(bioLinks, externalUrl)) {
    if (DELIVERY_PATTERN.test(link)) return link.startsWith("http") ? link : `https://${link}`;
  }

  if (biography) {
    const m = biography.match(DELIVERY_PATTERN);
    if (m) return `https://${m[0]}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// LEGADO (mantém compatibilidade com discovery worker)
// ---------------------------------------------------------------------------

export function parseInstagramBio(bioText: string): ParsedBioData {
  const data: ParsedBioData = {
    whatsapp: null,
    linktree: null,
    digitalMenu: null,
  };

  if (!bioText) return data;

  // 1. Buscar WhatsApp (Links wa.me ou api.whatsapp.com)
  const waMatch = bioText.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)([0-9]+)/);
  if (waMatch) {
    data.whatsapp = waMatch[1]; // Pega só os números
  } else {
    // Fallback: Busca números de telefone formatados no meio do texto do Brasil (ex: 11 99999-9999)
    const phoneMatch = bioText.match(/(?:(?:\+|00)?(55)\s?)?(?:\(?([1-9][0-9])\)?\s?)?(?:((?:9\d|[2-9])\d{3})\-?(\d{4}))/);
    if (phoneMatch) {
      // Junta o DDD e o número achado
      data.whatsapp = `${phoneMatch[2] || ""}${phoneMatch[3]}${phoneMatch[4]}`;
    }
  }

  // 2. Buscar Linktree
  const linktreeMatch = bioText.match(/linktr\.ee\/[a-zA-Z0-9_-]+/);
  if (linktreeMatch) {
    data.linktree = `https://${linktreeMatch[0]}`;
  }

  // 3. Buscar Cardápios Digitais (Goomer, OlaClick, MenuDino, etc)
  const menuMatch = bioText.match(/(goomer\.app|olaclick\.com|menudino\.com|hubt\.com\.br)\/[a-zA-Z0-9_-]+/);
  if (menuMatch) {
    data.digitalMenu = `https://${menuMatch[0]}`;
  }

  return data;
}