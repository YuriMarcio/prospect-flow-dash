// Regras dos lembretes push de tarefas — funções puras (sem banco, sem relógio), pra testar fácil.
// A parte com I/O (agendamento, banco, envio) fica em push-reminders.worker.ts.

/**
 * today        manhã: o que vence hoje + o que já está atrasado
 * sprint       manhã: sprint terminando em até 2 dias com trabalho pendente
 * due_tomorrow tarde: o que vence amanhã
 * evening      fim do dia: o que ainda falta para bater a meta do dia
 */
export type ReminderKind = "today" | "sprint" | "due_tomorrow" | "evening";

export interface ReminderItem {
  id: string;
  title: string;
  /** "YYYY-MM-DD" */
  dueDate: string | null;
  assignedUserId: string | null;
  progress: number;
  /** Coluna do item de topo a que ele pertence (marcos/issues herdam a do objetivo). */
  columnId: string | null;
  sprintId: string | null;
}

export interface ReminderSprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface Reminder {
  kind: ReminderKind;
  /** Chave única do envio — impede repetir o mesmo lembrete no mesmo dia. */
  dedupeKey: string;
  title: string;
  body: string;
  tag: string;
}

export interface LocalNow {
  /** "YYYY-MM-DD" no fuso configurado */
  date: string;
  hour: number;
}

/**
 * Janela (hora local, fim exclusivo) em que cada lembrete pode sair. Em vez de exigir o minuto exato,
 * qualquer ciclo dentro da janela envia — assim um redeploy às 08:03 não faz perder o lembrete das 08:00,
 * e a janela curta evita mandar "bom dia" às 11:59 de uma API que reiniciou tarde.
 */
const WINDOWS: Record<ReminderKind, { from: number; to: number }> = {
  today: { from: 8, to: 12 },
  sprint: { from: 8, to: 12 },
  due_tomorrow: { from: 16, to: 19 },
  evening: { from: 18, to: 21 },
};

const SPRINT_WARNING_DAYS = 2;
const MAX_LISTED = 3;
const MAX_TITLE_LENGTH = 60;

export function localNow(now: Date, timeZone: string): LocalNow {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 };
}

export function kindsDueAt(hour: number): ReminderKind[] {
  return (Object.keys(WINDOWS) as ReminderKind[]).filter((kind) => hour >= WINDOWS[kind].from && hour < WINDOWS[kind].to);
}

function toUtcDay(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function addDays(isoDate: string, days: number): string {
  return new Date(toUtcDay(isoDate) + days * 86_400_000).toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtcDay(toIso) - toUtcDay(fromIso)) / 86_400_000);
}

export function isPending(item: ReminderItem, doneColumnIds: Set<string>): boolean {
  if (item.progress >= 100) return false;
  return !(item.columnId && doneColumnIds.has(item.columnId));
}

/** Item atribuído ao usuário; sem responsável, todo mundo da equipe com push ativo recebe. */
export function isRelevantTo(item: ReminderItem, userId: string): boolean {
  return item.assignedUserId === null || item.assignedUserId === userId;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function truncate(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > MAX_TITLE_LENGTH ? `${clean.slice(0, MAX_TITLE_LENGTH - 1)}…` : clean;
}

function byDueDateThenTitle(a: ReminderItem, b: ReminderItem): number {
  return (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.title.localeCompare(b.title, "pt-BR");
}

function bulletList(items: ReminderItem[]): string {
  const sorted = [...items].sort(byDueDateThenTitle);
  const lines = sorted.slice(0, MAX_LISTED).map((item) => `• ${truncate(item.title)}`);
  if (sorted.length > MAX_LISTED) lines.push(`+ ${sorted.length - MAX_LISTED} ${sorted.length - MAX_LISTED === 1 ? "outra" : "outras"}`);
  return lines.join("\n");
}

function overdueLine(count: number): string {
  return `⚠️ ${plural(count, "atrasada", "atrasadas")}`;
}

function digest(kind: ReminderKind, userId: string, date: string, title: string, body: string): Reminder {
  return { kind, dedupeKey: `${kind}:${date}:${userId}`, title, body, tag: kind };
}

function buildToday(userId: string, date: string, dueToday: ReminderItem[], overdue: ReminderItem[]): Reminder | null {
  if (dueToday.length > 0) {
    const body = overdue.length > 0 ? `${bulletList(dueToday)}\n${overdueLine(overdue.length)}` : bulletList(dueToday);
    return digest("today", userId, date, `📅 ${plural(dueToday.length, "tarefa para hoje", "tarefas para hoje")}`, body);
  }
  if (overdue.length > 0) {
    return digest("today", userId, date, `⚠️ ${plural(overdue.length, "tarefa atrasada", "tarefas atrasadas")}`, bulletList(overdue));
  }
  return null;
}

function buildDueTomorrow(userId: string, date: string, dueTomorrow: ReminderItem[]): Reminder | null {
  if (dueTomorrow.length === 0) return null;
  const title = dueTomorrow.length === 1 ? "⏰ 1 tarefa vence amanhã" : `⏰ ${dueTomorrow.length} tarefas vencem amanhã`;
  return digest("due_tomorrow", userId, date, title, bulletList(dueTomorrow));
}

function buildEvening(userId: string, date: string, dueToday: ReminderItem[], overdue: ReminderItem[]): Reminder | null {
  const open = [...dueToday, ...overdue];
  if (open.length === 0) return null;
  const title = open.length === 1 ? "🎯 Falta 1 tarefa para fechar o dia" : `🎯 Faltam ${open.length} tarefas para fechar o dia`;
  const body = dueToday.length > 0 && overdue.length > 0 ? `${bulletList(open)}\n${overdueLine(overdue.length)}` : bulletList(open);
  return digest("evening", userId, date, title, body);
}

function buildSprintReminders(
  userId: string,
  date: string,
  items: ReminderItem[],
  doneColumnIds: Set<string>,
  sprints: ReminderSprint[],
): Reminder[] {
  const reminders: Reminder[] = [];
  for (const sprint of sprints) {
    const daysLeft = daysBetween(date, sprint.endDate);
    if (sprint.startDate > date || daysLeft < 0 || daysLeft > SPRINT_WARNING_DAYS) continue;

    const sprintItems = items.filter((item) => item.sprintId === sprint.id);
    const pending = sprintItems.filter((item) => isPending(item, doneColumnIds));
    const mine = pending.filter((item) => isRelevantTo(item, userId));
    // Só avisa quem tem trabalho dele na sprint — não adianta cutucar quem não tem nada a entregar.
    if (mine.length === 0) continue;

    const when = daysLeft === 0 ? "termina hoje" : daysLeft === 1 ? "termina amanhã" : `termina em ${daysLeft} dias`;
    const summary = `${sprintItems.length - pending.length} de ${sprintItems.length} concluídas · faltam ${pending.length}`;
    reminders.push({
      kind: "sprint",
      dedupeKey: `sprint:${sprint.id}:${date}:${userId}`,
      title: `🏁 ${truncate(sprint.name)} ${when}`,
      body: `${summary}\n${bulletList(mine)}`,
      tag: `sprint-${sprint.id}`,
    });
  }
  return reminders;
}

export function buildReminders(input: {
  kinds: ReminderKind[];
  userId: string;
  date: string;
  items: ReminderItem[];
  doneColumnIds: Set<string>;
  sprints: ReminderSprint[];
}): Reminder[] {
  const { kinds, userId, date, items, doneColumnIds, sprints } = input;

  const mine = items.filter((item) => item.dueDate && isRelevantTo(item, userId) && isPending(item, doneColumnIds));
  const dueToday = mine.filter((item) => item.dueDate === date);
  const overdue = mine.filter((item) => item.dueDate! < date);
  const dueTomorrow = mine.filter((item) => item.dueDate === addDays(date, 1));

  const reminders: Reminder[] = [];
  for (const kind of kinds) {
    if (kind === "today") {
      const reminder = buildToday(userId, date, dueToday, overdue);
      if (reminder) reminders.push(reminder);
    } else if (kind === "due_tomorrow") {
      const reminder = buildDueTomorrow(userId, date, dueTomorrow);
      if (reminder) reminders.push(reminder);
    } else if (kind === "evening") {
      const reminder = buildEvening(userId, date, dueToday, overdue);
      if (reminder) reminders.push(reminder);
    } else {
      reminders.push(...buildSprintReminders(userId, date, items, doneColumnIds, sprints));
    }
  }
  return reminders;
}
