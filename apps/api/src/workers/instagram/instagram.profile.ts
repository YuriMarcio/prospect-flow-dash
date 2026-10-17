import {
  extractDeliveryLinkFromBio,
  extractLinktreeFromBio,
  extractWhatsappFromBio,
} from "./instagram.parser";

/** Perfil no formato do ScrapeCreators (`/v1/instagram/profile`); o Apify é convertido para ele em instagram.provider.ts. */
export interface ScrapeCreatorsProfile {
  username?: string;
  full_name?: string;
  biography?: string;
  bio_links?: Array<{ url: string }>;
  external_url?: string | null;
  follower_count?: number;
}

/** Colunas do lead que a bio do perfil preenche. Gravar `enriched_at` evita consultar o mesmo perfil de novo. */
export function profileToLeadFields(profile: ScrapeCreatorsProfile) {
  const bio = profile.biography ?? "";
  const bioLinks = profile.bio_links ?? [];
  const extUrl = profile.external_url ?? undefined;

  return {
    whatsapp:      extractWhatsappFromBio(bio, bioLinks, extUrl),
    linktree:      extractLinktreeFromBio(bio, bioLinks, extUrl),
    delivery_link: extractDeliveryLinkFromBio(bio, bioLinks, extUrl),
    biography:     profile.biography    ?? null,
    external_url:  profile.external_url ?? null,
    followers:     profile.follower_count ?? null,
    bio_links:     bioLinks,
    enriched_at:   new Date().toISOString(),
  };
}

/**
 * O provedor de perfis (Apify ou ScrapeCreators) recusou a consulta por chave inválida ou créditos esgotados (401/402/403).
 * Insistir lead por lead só repete o erro, então quem chama deve parar de consultar.
 */
export function providerRejection(err: unknown): number | null {
  const status = (err as { response?: { status?: number } } | null)?.response?.status;
  return status === 401 || status === 402 || status === 403 ? status : null;
}
