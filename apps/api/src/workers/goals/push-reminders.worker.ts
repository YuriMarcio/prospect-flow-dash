import * as objectivesRepository from "../../modules/objectives/objectives.repository";
import type { ObjectiveRow } from "../../modules/objectives/objectives.repository";
import * as pushRepository from "../../modules/push/push.repository";
import { sendToUser } from "../../modules/push/push.service";
import { isPushConfigured } from "../../lib/webpush";
import { buildReminders, kindsDueAt, localNow, type ReminderItem } from "./task-reminders";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const LOG_RETENTION_DAYS = 30;

// O servidor roda em UTC no Docker: sem fuso explícito, "08:00" e "hoje" seriam os de Greenwich.
function resolveTimezone(): string {
  const configured = process.env.APP_TIMEZONE?.trim();
  if (!configured) return DEFAULT_TIMEZONE;
  try {
    localNow(new Date(), configured);
    return configured;
  } catch {
    console.warn(`[PUSH] APP_TIMEZONE inválido ("${configured}") — usando ${DEFAULT_TIMEZONE}.`);
    return DEFAULT_TIMEZONE;
  }
}

/** Marcos, issues e subissues não têm coluna própria: valem a do objetivo de topo em que estão. */
function toReminderItems(rows: ObjectiveRow[]): ReminderItem[] {
  const byId = new Map(rows.map((row) => [row.id, row]));

  function rootColumnId(row: ObjectiveRow): string | null {
    const visited = new Set<string>();
    let current: ObjectiveRow | undefined = row;
    while (current?.parent_objective_id && !visited.has(current.id)) {
      visited.add(current.id);
      current = byId.get(current.parent_objective_id);
    }
    return current?.column_id ?? null;
  }

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    dueDate: row.due_date,
    assignedUserId: row.assigned_user_id,
    progress: row.progress,
    columnId: row.column_id ?? rootColumnId(row),
    sprintId: row.sprint_id,
  }));
}

let lastPurgeDate: string | null = null;

/**
 * Roda a cada poucos minutos. Fora das janelas de horário não toca no banco; dentro delas, calcula
 * os lembretes de cada usuário com push ativo e envia os que ainda não saíram hoje.
 */
export async function runTaskReminderTick(now: Date = new Date()): Promise<void> {
  if (!isPushConfigured()) return;

  const local = localNow(now, resolveTimezone());
  const kinds = kindsDueAt(local.hour);
  if (kinds.length === 0) return;

  const userIds = await pushRepository.listSubscribedUserIds();
  if (userIds.length === 0) return;

  const [objectives, columns, sprints] = await Promise.all([
    objectivesRepository.findAll(),
    objectivesRepository.listColumns(),
    objectivesRepository.findAllSprints(),
  ]);
  const items = toReminderItems(objectives);
  const doneColumnIds = new Set(columns.filter((column) => column.is_done).map((column) => column.id));
  const reminderSprints = sprints.map((sprint) => ({
    id: sprint.id,
    name: sprint.name,
    startDate: sprint.start_date,
    endDate: sprint.end_date,
  }));

  for (const userId of userIds) {
    const reminders = buildReminders({ kinds, userId, date: local.date, items, doneColumnIds, sprints: reminderSprints });

    for (const reminder of reminders) {
      let claimed = false;
      try {
        // Reserva antes de enviar: dois ciclos (ou dois processos) nunca mandam o mesmo lembrete.
        claimed = await pushRepository.claimNotification(reminder.dedupeKey, userId, reminder.kind);
        if (!claimed) continue;

        const summary = await sendToUser(userId, {
          title: reminder.title,
          body: reminder.body,
          tag: reminder.tag,
          url: "/objetivos",
        });
        // Nenhum aparelho recebeu por erro passageiro: devolve a reserva pra tentar no próximo ciclo.
        if (summary.delivered === 0 && summary.retryable) await pushRepository.releaseNotification(reminder.dedupeKey);
      } catch (error) {
        console.error(`[PUSH] Falha no lembrete ${reminder.dedupeKey}:`, error);
        if (claimed) await pushRepository.releaseNotification(reminder.dedupeKey).catch(() => undefined);
      }
    }
  }

  if (lastPurgeDate !== local.date) {
    lastPurgeDate = local.date;
    await pushRepository.purgeNotificationLog(LOG_RETENTION_DAYS).catch((error) => {
      console.warn("[PUSH] Não foi possível limpar o log de notificações:", error);
    });
  }
}
