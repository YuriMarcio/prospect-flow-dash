import { parseProfileLink, type NicheEvidence, type ProfileLink } from "../instagram/instagram.filters";
import { matchLocation, type LocationEvidence } from "./location";

/**
 * approved = nicho e cidade confirmados: salva direto.
 * pending  = nicho confirmado, cidade desconhecida: vale 1 chamada de bio para confirmar.
 * queued   = cidade confirmada, nicho desconhecido: fila técnica, sem gastar crédito.
 * rejected = URL inválida, cidade comprovadamente errada, ou nenhuma evidência.
 */
export type Decision = "approved" | "pending" | "queued" | "rejected";

export function decide(niche: NicheEvidence, location: LocationEvidence): Decision {
  if (location === "mismatch") return "rejected";
  if (niche === "confirmed") return location === "confirmed" ? "approved" : "pending";
  return location === "confirmed" ? "queued" : "rejected";
}

export interface InstagramSearchResult {
  title: string;
  link: string;
  snippet?: string;
}

export interface ClassificationContext {
  matchNiche: (texts: string[]) => NicheEvidence;
  city: string;
  state?: string | null;
}

export interface Classified {
  decision: Decision;
  niche: NicheEvidence;
  location: LocationEvidence;
  profile: ProfileLink | null;
}

export function classifyInstagramResult(result: InstagramSearchResult, ctx: ClassificationContext): Classified {
  const profile = parseProfileLink(result.link);
  if (!profile) return { decision: "rejected", niche: "unknown", location: "unknown", profile: null };

  const snippet = result.snippet ?? "";
  const niche = ctx.matchNiche([result.title, snippet, profile.handle]);
  const location = matchLocation([result.title, snippet], ctx.city, ctx.state);

  return { decision: decide(niche, location), niche, location, profile };
}
