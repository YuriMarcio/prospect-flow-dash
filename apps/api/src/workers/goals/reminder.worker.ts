import * as objectivesRepository from "../../modules/objectives/objectives.repository";
import type { ObjectiveRow } from "../../modules/objectives/objectives.repository";
import * as prospectorRepository from "../../modules/prospector/prospector.repository";
import { getUserById } from "../../modules/auth/auth.service";
import { getEvolutionClient } from "../../lib/evolution";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateBr(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
}

async function groupPendingByAssignee(
  predicate: (objective: ObjectiveRow, doneColumnIds: Set<string>) => boolean,
): Promise<Map<string, ObjectiveRow[]>> {
  const [objectives, columns] = await Promise.all([
    objectivesRepository.findAll(),
    objectivesRepository.listColumns(),
  ]);
  const doneColumnIds = new Set(columns.filter((c) => c.is_done).map((c) => c.id));

  const byAssignee = new Map<string, ObjectiveRow[]>();
  for (const objective of objectives) {
    if (!objective.assigned_user_id) continue;
    if (!predicate(objective, doneColumnIds)) continue;
    const list = byAssignee.get(objective.assigned_user_id) ?? [];
    list.push(objective);
    byAssignee.set(objective.assigned_user_id, list);
  }
  return byAssignee;
}

async function sendToAssignee(userId: string, message: string): Promise<void> {
  const user = await getUserById(userId);
  const digits = user?.phone?.replace(/\D/g, "") ?? "";
  if (!digits) {
    console.warn(`[GOALS] Usuário ${userId} sem telefone cadastrado — lembrete não enviado.`);
    return;
  }

  const instance = await prospectorRepository.findInstanceByChannel("whatsapp", userId);
  if (!instance || instance.status !== "connected") {
    console.warn(`[GOALS] Usuário ${userId} sem instância de WhatsApp conectada — lembrete não enviado.`);
    return;
  }

  const client = getEvolutionClient();
  await client.sendText(instance.instance_name, digits, message);
}

/** Lembrete de manhã: o que está previsto pra hoje (due_date === hoje) e ainda não concluído. */
export async function runMorningReminder(): Promise<void> {
  const today = todayIso();
  const byAssignee = await groupPendingByAssignee(
    (objective, doneColumnIds) => objective.due_date === today && !doneColumnIds.has(objective.column_id),
  );

  for (const [userId, objectives] of byAssignee) {
    const lines = [
      "☀️ Bom dia! Objetivos de hoje:",
      ...objectives.map((o) => `- ${o.title}`),
    ];
    await sendToAssignee(userId, lines.join("\n"));
  }
}

/** Lembrete de fim de tarde: tudo que venceu hoje ou antes e ainda não foi concluído. */
export async function runEveningReminder(): Promise<void> {
  const today = todayIso();
  const byAssignee = await groupPendingByAssignee(
    (objective, doneColumnIds) =>
      Boolean(objective.due_date) && objective.due_date! <= today && !doneColumnIds.has(objective.column_id),
  );

  for (const [userId, objectives] of byAssignee) {
    const lines = [
      "🌙 Ainda falta:",
      ...objectives.map((o) => `- ${o.title}${o.due_date ? ` (venceu em ${formatDateBr(o.due_date)})` : ""}`),
    ];
    await sendToAssignee(userId, lines.join("\n"));
  }
}
