import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  buildReminders,
  daysBetween,
  kindsDueAt,
  localNow,
  type ReminderItem,
  type ReminderSprint,
} from "./task-reminders";

const ME = "user-me";
const OTHER = "user-other";
const TODAY = "2026-10-13";

function item(overrides: Partial<ReminderItem> & { id: string }): ReminderItem {
  return {
    title: `Tarefa ${overrides.id}`,
    dueDate: null,
    assignedUserId: ME,
    progress: 0,
    columnId: null,
    sprintId: null,
    ...overrides,
  };
}

function build(kinds: Parameters<typeof buildReminders>[0]["kinds"], items: ReminderItem[], extra?: {
  doneColumnIds?: string[];
  sprints?: ReminderSprint[];
}) {
  return buildReminders({
    kinds,
    userId: ME,
    date: TODAY,
    items,
    doneColumnIds: new Set(extra?.doneColumnIds ?? []),
    sprints: extra?.sprints ?? [],
  });
}

describe("localNow", () => {
  it("usa o fuso pedido, não o do servidor (UTC)", () => {
    // 11:30 UTC = 08:30 em São Paulo
    assert.deepEqual(localNow(new Date("2026-10-13T11:30:00Z"), "America/Sao_Paulo"), { date: "2026-10-13", hour: 8 });
  });

  it("vira o dia junto com o fuso: 01:00 UTC ainda é a noite anterior no Brasil", () => {
    assert.deepEqual(localNow(new Date("2026-10-14T01:00:00Z"), "America/Sao_Paulo"), { date: "2026-10-13", hour: 22 });
  });

  it("meia-noite local é hora 0, nunca 24", () => {
    assert.equal(localNow(new Date("2026-10-13T03:00:00Z"), "America/Sao_Paulo").hour, 0);
  });
});

describe("kindsDueAt", () => {
  it("manhã: resumo do dia e aviso de sprint", () => {
    assert.deepEqual(kindsDueAt(8), ["today", "sprint"]);
    assert.deepEqual(kindsDueAt(11), ["today", "sprint"]);
  });

  it("não envia fora das janelas", () => {
    assert.deepEqual(kindsDueAt(7), []);
    assert.deepEqual(kindsDueAt(12), []);
    assert.deepEqual(kindsDueAt(14), []);
    assert.deepEqual(kindsDueAt(22), []);
    assert.deepEqual(kindsDueAt(3), []);
  });

  it("tarde e fim do dia se sobrepõem às 18h", () => {
    assert.deepEqual(kindsDueAt(16), ["due_tomorrow"]);
    assert.deepEqual(kindsDueAt(18), ["due_tomorrow", "evening"]);
    assert.deepEqual(kindsDueAt(20), ["evening"]);
  });
});

describe("datas", () => {
  it("addDays atravessa mês e ano", () => {
    assert.equal(addDays("2026-10-31", 1), "2026-11-01");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  });

  it("daysBetween", () => {
    assert.equal(daysBetween("2026-10-13", "2026-10-15"), 2);
    assert.equal(daysBetween("2026-10-13", "2026-10-12"), -1);
  });
});

describe("lembrete da manhã (today)", () => {
  it("lista o que vence hoje", () => {
    const [reminder] = build(["today"], [item({ id: "a", title: "Postar carrossel", dueDate: TODAY })]);
    assert.equal(reminder.title, "📅 1 tarefa para hoje");
    assert.equal(reminder.body, "• Postar carrossel");
    assert.equal(reminder.dedupeKey, `today:${TODAY}:${ME}`);
  });

  it("acrescenta as atrasadas ao resumo do dia", () => {
    const [reminder] = build(["today"], [
      item({ id: "a", dueDate: TODAY }),
      item({ id: "b", dueDate: "2026-10-01" }),
      item({ id: "c", dueDate: "2026-09-13" }),
    ]);
    assert.equal(reminder.title, "📅 1 tarefa para hoje");
    assert.match(reminder.body, /⚠️ 2 atrasadas$/);
  });

  it("sem nada para hoje, mas com atraso, avisa do atraso", () => {
    const [reminder] = build(["today"], [item({ id: "c", title: "Carrossel", dueDate: "2026-09-13" })]);
    assert.equal(reminder.title, "⚠️ 1 tarefa atrasada");
    assert.equal(reminder.body, "• Carrossel");
  });

  it("não manda nada quando não há o que avisar", () => {
    assert.deepEqual(build(["today"], [item({ id: "a", dueDate: "2026-10-20" }), item({ id: "b", dueDate: null })]), []);
  });

  it("ignora tarefa concluída por progresso ou por estar em coluna de concluído", () => {
    const items = [
      item({ id: "a", dueDate: TODAY, progress: 100 }),
      item({ id: "b", dueDate: TODAY, columnId: "col-done" }),
    ];
    assert.deepEqual(build(["today"], items, { doneColumnIds: ["col-done"] }), []);
  });

  it("lista no máximo 3 títulos e resume o resto", () => {
    const items = ["a", "b", "c", "d", "e"].map((id) => item({ id, title: `T-${id}`, dueDate: TODAY }));
    const [reminder] = build(["today"], items);
    assert.equal(reminder.title, "📅 5 tarefas para hoje");
    assert.equal(reminder.body, "• T-a\n• T-b\n• T-c\n+ 2 outras");
  });

  it("corta título muito longo", () => {
    const [reminder] = build(["today"], [item({ id: "a", title: "x".repeat(200), dueDate: TODAY })]);
    assert.ok(reminder.body.length <= 2 + 60);
    assert.ok(reminder.body.endsWith("…"));
  });
});

describe("quem recebe", () => {
  it("tarefa de outro responsável não entra", () => {
    assert.deepEqual(build(["today"], [item({ id: "a", dueDate: TODAY, assignedUserId: OTHER })]), []);
  });

  it("tarefa sem responsável vai para todos", () => {
    assert.equal(build(["today"], [item({ id: "a", dueDate: TODAY, assignedUserId: null })]).length, 1);
  });
});

describe("vence amanhã (due_tomorrow)", () => {
  it("avisa só o que vence amanhã", () => {
    const items = [
      item({ id: "a", dueDate: "2026-10-14", title: "Entregar proposta" }),
      item({ id: "b", dueDate: TODAY }),
      item({ id: "c", dueDate: "2026-10-15" }),
    ];
    const [reminder] = build(["due_tomorrow"], items);
    assert.equal(reminder.title, "⏰ 1 tarefa vence amanhã");
    assert.equal(reminder.body, "• Entregar proposta");
  });

  it("plural", () => {
    const items = [item({ id: "a", dueDate: "2026-10-14" }), item({ id: "b", dueDate: "2026-10-14" })];
    assert.equal(build(["due_tomorrow"], items)[0].title, "⏰ 2 tarefas vencem amanhã");
  });
});

describe("meta do dia (evening)", () => {
  it("conta o que falta de hoje e o atrasado", () => {
    const [reminder] = build(["evening"], [
      item({ id: "a", dueDate: TODAY }),
      item({ id: "b", dueDate: "2026-10-10" }),
      item({ id: "c", dueDate: TODAY, progress: 100 }),
    ]);
    assert.equal(reminder.title, "🎯 Faltam 2 tarefas para fechar o dia");
    assert.match(reminder.body, /⚠️ 1 atrasada$/);
    assert.equal(reminder.dedupeKey, `evening:${TODAY}:${ME}`);
  });

  it("singular", () => {
    assert.equal(build(["evening"], [item({ id: "a", dueDate: TODAY })])[0].title, "🎯 Falta 1 tarefa para fechar o dia");
  });

  it("dia limpo não gera aviso", () => {
    assert.deepEqual(build(["evening"], [item({ id: "a", dueDate: TODAY, progress: 100 })]), []);
  });
});

describe("meta da sprint (sprint)", () => {
  const sprint: ReminderSprint = { id: "s1", name: "Sprint 02", startDate: "2026-10-07", endDate: "2026-10-14" };

  it("avisa quando a sprint termina em até 2 dias com trabalho pendente", () => {
    const items = [
      item({ id: "a", sprintId: "s1", progress: 100 }),
      item({ id: "b", sprintId: "s1", title: "Fechar relatório" }),
      item({ id: "c", sprintId: "s1", assignedUserId: OTHER }),
    ];
    const [reminder] = build(["sprint"], items, { sprints: [sprint] });
    assert.equal(reminder.title, "🏁 Sprint 02 termina amanhã");
    assert.equal(reminder.body, "1 de 3 concluídas · faltam 2\n• Fechar relatório");
    assert.equal(reminder.dedupeKey, `sprint:s1:${TODAY}:${ME}`);
  });

  it("no último dia diz 'hoje'", () => {
    const items = [item({ id: "b", sprintId: "s1" })];
    const [reminder] = build(["sprint"], items, { sprints: [{ ...sprint, endDate: TODAY }] });
    assert.equal(reminder.title, "🏁 Sprint 02 termina hoje");
  });

  it("sprint longe do fim, já encerrada ou ainda não iniciada não avisa", () => {
    const items = [item({ id: "b", sprintId: "s1" })];
    assert.deepEqual(build(["sprint"], items, { sprints: [{ ...sprint, endDate: "2026-10-20" }] }), []);
    assert.deepEqual(build(["sprint"], items, { sprints: [{ ...sprint, endDate: "2026-10-12" }] }), []);
    assert.deepEqual(build(["sprint"], items, { sprints: [{ ...sprint, startDate: "2026-10-14", endDate: "2026-10-15" }] }), []);
  });

  it("sprint toda concluída ou sem trabalho meu não avisa", () => {
    assert.deepEqual(build(["sprint"], [item({ id: "a", sprintId: "s1", progress: 100 })], { sprints: [sprint] }), []);
    assert.deepEqual(
      build(["sprint"], [item({ id: "a", sprintId: "s1", assignedUserId: OTHER })], { sprints: [sprint] }),
      [],
    );
  });
});

describe("vários tipos no mesmo ciclo", () => {
  it("às 18h sai o 'vence amanhã' e o 'meta do dia', cada um com sua chave", () => {
    const items = [item({ id: "a", dueDate: TODAY }), item({ id: "b", dueDate: "2026-10-14" })];
    const reminders = build(["due_tomorrow", "evening"], items);
    assert.deepEqual(reminders.map((r) => r.kind), ["due_tomorrow", "evening"]);
    assert.equal(new Set(reminders.map((r) => r.dedupeKey)).size, 2);
  });
});
