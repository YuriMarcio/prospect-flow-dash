import {
  extractDeliveryLinkFromBio,
  extractLinktreeFromBio,
  extractWhatsappFromBio,
} from "./instagram.parser";

/** Perfil devolvido pelo ScrapeCreators (`/v1/instagram/profile`). */
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
