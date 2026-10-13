import { getSupabase } from "../../lib/supabase";

/** Candidato que não virou lead: fica numa fila técnica, fora do Kanban, para revisão. */
export interface QueuedCandidate {
  campaign_id: string;
  source: "instagram" | "maps";
  /** Chave de deduplicação dentro da campanha: handle do Instagram ou place_id do Maps. */
  dedupe_key: string;
  name: string | null;
  instagram: string | null;
  place_id: string | null;
  address: string | null;
  niche: string;
  location: string;
  /** Por que está na fila: location_unconfirmed, niche_unconfirmed, enrich_budget_exhausted... */
  reason: string;
  evidence: Record<string, unknown>;
}

export interface SaveQueuedResult {
  persisted: boolean;
  error?: string;
}

/**
 * Grava a fila técnica. Tolerante: se a tabela `discovery_candidates` ainda não existe
 * (migration não aplicada), devolve `persisted: false` e a campanha segue — a contagem
 * continua no log.
 */
export async function saveQueued(rows: QueuedCandidate[]): Promise<SaveQueuedResult> {
  if (rows.length === 0) return { persisted: true };

  try {
    const { error } = await getSupabase()
      .from("discovery_candidates")
      .upsert(rows, { onConflict: "campaign_id,dedupe_key", ignoreDuplicates: true });
    return error ? { persisted: false, error: error.message } : { persisted: true };
  } catch (err) {
    return { persisted: false, error: err instanceof Error ? err.message : String(err) };
  }
}
