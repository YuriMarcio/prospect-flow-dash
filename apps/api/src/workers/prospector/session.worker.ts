import * as campaignsRepository from "../../modules/prospecting-campaigns/prospecting-campaigns.repository";
import * as queueRepository from "../../modules/prospector/queue.repository";
import * as botLogs from "../../modules/prospector/botlogs.repository";

export type SessionMode = "until_done" | "custom";

export async function startSessionForCampaign(
  campaignId: string,
  input: { mode: SessionMode; startAt?: string; endAt?: string },
) {
  const startAt = input.mode === "custom" && input.startAt ? input.startAt : new Date().toISOString();
  const endAt = input.mode === "custom" ? input.endAt ?? null : null;

  const isStartingNow = new Date(startAt).getTime() <= Date.now();

  const campaign = await campaignsRepository.update(campaignId, {
    session_mode: input.mode,
    session_start_at: startAt,
    session_end_at: endAt,
    is_active: isStartingNow ? true : false,
  });

  await botLogs.create(
    isStartingNow
      ? `Bot ativado agora${endAt ? ` até ${new Date(endAt).toLocaleTimeString("pt-BR")}` : input.mode === "until_done" ? " (até terminar a fila de hoje)" : ""}.`
      : `Bot agendado para iniciar às ${new Date(startAt).toLocaleTimeString("pt-BR")}.`,
    "info",
    campaignId,
  );

  return campaign;
}

export async function stopSessionForCampaign(campaignId: string) {
  const campaign = await campaignsRepository.update(campaignId, {
    is_active: false,
    session_mode: null,
    session_start_at: null,
    session_end_at: null,
  });
  await botLogs.create(`Bot pausado manualmente.`, "info", campaignId);
  return campaign;
}

/**
 * Roda a cada 60s junto com o dispatcher, pra cada campanha: liga o bot quando
 * bate o session_start_at agendado, e desliga quando bate o session_end_at
 * (modo custom).
 */
export async function runSessionTick(): Promise<void> {
  const campaigns = await campaignsRepository.findAll();

  for (const campaign of campaigns) {
    if (!campaign.session_mode) continue;

    const now = Date.now();

    if (!campaign.is_active && campaign.session_start_at && new Date(campaign.session_start_at).getTime() <= now) {
      await campaignsRepository.update(campaign.id, { is_active: true });
      await botLogs.create(`Bot ativado (horário agendado atingido).`, "info", campaign.id);
      continue;
    }

    if (
      campaign.session_mode === "custom" &&
      campaign.session_end_at &&
      new Date(campaign.session_end_at).getTime() <= now
    ) {
      await stopSessionForCampaign(campaign.id);
      await botLogs.create(`Bot pausado automaticamente: horário final da sessão atingido.`, "info", campaign.id);
    }
  }
}

/**
 * Chamado pelo dispatcher após cada tick de uma campanha: se a sessão é "até
 * terminar a fila de hoje" e não há mais nada esperando, pausa o bot sozinho.
 */
export async function checkUntilDoneCompletion(campaignId: string): Promise<void> {
  const campaign = await campaignsRepository.findById(campaignId);
  if (!campaign || campaign.session_mode !== "until_done" || !campaign.is_active) return;

  // Ignora follow-ups agendados pra dias futuros — senão a sessão "até
  // terminar" nunca consideraria a fila do dia concluída.
  const remaining = await queueRepository.countWaitingDueToday(campaignId);
  const sentSoFar = await queueRepository.countToday(campaignId, "sent");

  if (remaining === 0 && sentSoFar > 0) {
    await stopSessionForCampaign(campaignId);
    await botLogs.create(`Bot pausado automaticamente: fila de hoje concluída.`, "info", campaignId);
  }
}
