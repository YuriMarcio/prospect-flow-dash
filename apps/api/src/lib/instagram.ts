/**
 * Aceita "@perfil", "perfil" ou a URL do perfil e devolve sempre a URL
 * canônica (https://www.instagram.com/perfil/) — o mesmo formato que as
 * capturas gravam em leads.instagram. Devolve null se não for um perfil válido.
 */
export function toInstagramUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const fromUrl = trimmed.match(/instagram\.com\/([^/?#\s]+)/i)?.[1];
  const handle = (fromUrl ?? trimmed).replace(/^@/, "");

  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return null;
  if (["p", "reel", "reels", "stories", "explore", "accounts", "tv"].includes(handle.toLowerCase())) return null;
  return `https://www.instagram.com/${handle}/`;
}
