export interface ParsedBioData {
  whatsapp: string | null;
  linktree: string | null;
  digitalMenu: string | null;
}

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