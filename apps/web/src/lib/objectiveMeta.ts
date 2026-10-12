import type { Objective, ObjectiveArea, ObjectivePriority, Sprint } from "@/lib/objectives";

export const OBJECTIVE_AREAS: {
  value: ObjectiveArea;
  label: string;
  /** Bolinha (filtro, tag) */
  dot: string;
  /** Tag (pílula) no card e no detalhe */
  tag: string;
}[] = [
  { value: "vendas", label: "Vendas", dot: "bg-blue-500", tag: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  {
    value: "marketing",
    label: "Marketing",
    dot: "bg-violet-500",
    tag: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  {
    value: "administrativo",
    label: "Administrativo",
    dot: "bg-amber-500",
    tag: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  {
    value: "desenvolvimento",
    label: "Desenvolvimento",
    dot: "bg-emerald-500",
    tag: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
];

export const OBJECTIVE_PRIORITIES: { value: ObjectivePriority; label: string; className: string }[] = [
  { value: "critica", label: "Crítica", className: "text-destructive" },
  { value: "alta", label: "Alta", className: "text-amber-600 dark:text-amber-400" },
  { value: "media", label: "Média", className: "text-muted-foreground" },
  { value: "baixa", label: "Baixa", className: "text-muted-foreground/70" },
];

export function areaMeta(area: ObjectiveArea | null | undefined) {
  return OBJECTIVE_AREAS.find((a) => a.value === area) ?? null;
}

export function priorityMeta(priority: ObjectivePriority | null | undefined) {
  return OBJECTIVE_PRIORITIES.find((p) => p.value === priority) ?? null;
}

/** "OBJ-003" */
export function formatObjectiveCode(objective: Pick<Objective, "codeNumber">): string {
  return objective.codeNumber == null ? "OBJ" : `OBJ-${String(objective.codeNumber).padStart(3, "0")}`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "YYYY-MM-DD" como data local — `new Date("2026-10-12")` seria UTC e mostraria o dia anterior no Brasil. */
export function parseLocalDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00`);
}

/** Hoje (ou a data dada) como "YYYY-MM-DD" no fuso local. */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "03 de nov." */
export function formatShortDate(value: string): string {
  const date = parseLocalDate(value);
  return `${String(date.getDate()).padStart(2, "0")} de ${MONTHS[date.getMonth()]}.`;
}

/** "19–25 out" ou, atravessando o mês, "28 out – 03 nov". */
export function formatSprintRange(startDate: string, endDate: string): string {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) return `${start.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]}`;
  return `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
}

/** "Sprint 02 · 19–25 out" */
export function sprintLabel(sprint: Sprint): string {
  return `${sprint.name} · ${formatSprintRange(sprint.startDate, sprint.endDate)}`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
