import type { Capture } from "@/types";

/** ms decorridos desde o início da campanha, ou null se não há timestamp confiável. */
export function elapsedMs(campaign: Capture): number | null {
  if (!campaign.startedAtRaw) return null;
  const ms = Date.now() - new Date(campaign.startedAtRaw).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

export function formatElapsedHMS(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * Projeção linear simples (taxa atual de processamento * itens restantes).
 * Aproximação, não uma estimativa precisa — não há dado de fila/latência no backend.
 */
export function estimateRemainingMinutes(campaign: Capture): number | null {
  if (campaign.status !== "running" || campaign.processed <= 0 || campaign.quantity <= campaign.processed) {
    return null;
  }
  const ms = elapsedMs(campaign);
  if (ms === null) return null;
  const msPerItem = ms / campaign.processed;
  return Math.round((msPerItem * (campaign.quantity - campaign.processed)) / 60000);
}
