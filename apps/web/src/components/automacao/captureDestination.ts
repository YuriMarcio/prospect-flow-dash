export const NO_DESTINATION = "none";

/** Id da campanha de destino (ou undefined = Kanban geral): o fixo do painel tem prioridade sobre a escolha. */
export function resolveDestination(fixedCampaignId: string | null | undefined, selected: string) {
  return fixedCampaignId ?? (selected === NO_DESTINATION ? undefined : selected);
}
