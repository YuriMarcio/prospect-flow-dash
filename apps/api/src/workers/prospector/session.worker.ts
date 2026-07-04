import * as prospectorRepository from "../../modules/prospector/prospector.repository";
import * as queueRepository from "../../modules/prospector/queue.repository";
import * as botLogs from "../../modules/prospector/botlogs.repository";

export type SessionMode = "until_done" | "custom";

export async function startSessionService(input: {
  mode: SessionMode;
  startAt?: string;
  endAt?: string;
}) {
  const startAt = input.mode === "custom" && input.startAt ? input.startAt : new Date().toISOString();
  const endAt = input.mode === "custom" ? input.endAt ?? null : null;

  const isStartingNow = new Date(startAt).getTime() <= Date.now();

  const config = await prospectorRepository.updateConfig({
    session_mode: input.mode,
    session_start_at: startAt,
    session_end_at: endAt,
    is_active: isStartingNow ? true : false,
  });

  await botLogs.create(
    isStartingNow
      ? `Bot ativado agora${endAt ? ` até ${new Date(endAt).toLocaleTimeString("pt-BR")}` : input.mode === "until_done" ? " (até terminar a fila de hoje)" : ""}.`
      : `Bot agendado para iniciar às ${new Date(startAt).toLocaleTimeString("pt-BR")}.`,
  );

  return config;
}

export async function stopSessionService() {
  const config = await prospectorRepository.updateConfig({
    is_active: false,
    session_mode: null,
    session_start_at: null,
    session_end_at: null,
  });
  await botLogs.create(`Bot pausado manualmente.`);
  return config;
}

/**
 * Roda a cada 60s junto com o dispatcher: liga o bot quando bate o
 * session_start_at agendado, e desliga quando bate o session_end_at (modo custom).
 */
export async function runSessionTick(): Promise<void> {
  const config = await prospectorRepository.getConfig();
  if (!config.session_mode) return;

  const now = Date.now();

  if (!config.is_active && config.session_start_at && new Date(config.session_start_at).getTime() <= now) {
    await prospectorRepository.updateConfig({ is_active: true });
    await botLogs.create(`Bot ativado (horário agendado atingido).`);
    return;
  }

  if (config.session_mode === "custom" && config.session_end_at && new Date(config.session_end_at).getTime() <= now) {
    await stopSessionService();
    await botLogs.create(`Bot pausado automaticamente: horário final da sessão atingido.`);
  }
}

/**
 * Chamado pelo dispatcher após cada tick: se a sessão é "até terminar a fila
 * de hoje" e não há mais nada esperando, pausa o bot sozinho.
 */
export async function checkUntilDoneCompletion(): Promise<void> {
  const config = await prospectorRepository.getConfig();
  if (config.session_mode !== "until_done" || !config.is_active) return;

  const remaining = await queueRepository.countToday("waiting");
  const sentSoFar = await queueRepository.countToday("sent");

  if (remaining === 0 && sentSoFar > 0) {
    await stopSessionService();
    await botLogs.create(`Bot pausado automaticamente: fila de hoje concluída.`);
  }
}
