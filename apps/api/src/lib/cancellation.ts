const cancelled = new Set<string>();

export function cancel(campaignId: string): void {
  cancelled.add(campaignId);
}

export function isCancelled(campaignId: string): boolean {
  return cancelled.has(campaignId);
}

export function cleanup(campaignId: string): void {
  cancelled.delete(campaignId);
}
