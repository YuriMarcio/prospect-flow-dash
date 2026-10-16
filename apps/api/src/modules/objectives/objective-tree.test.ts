import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildObjectiveTreeRows, type ObjectiveTreeNode } from "./objective-tree";
import type { ObjectiveRow } from "./objectives.repository";

const COLUMN = "col-backlog";

function existingRow(partial: Partial<ObjectiveRow>): ObjectiveRow {
  return {
    id: "x",
    column_id: COLUMN,
    title: "existente",
    description: "",
    status: "not_started",
    progress: 0,
    due_date: null,
    owner: null,
    order: 0,
    linked_page_id: null,
    sprint_id: null,
    assigned_user_id: null,
    kind: "objective",
    parent_objective_id: null,
    area: null,
    priority: null,
    code_number: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

function ids() {
  let n = 0;
  return () => `id-${++n}`;
}

const leaf = (title: string, extra: Partial<ObjectiveTreeNode> = {}): ObjectiveTreeNode => ({ title, ...extra });

describe("buildObjectiveTreeRows", () => {
  it("numera e ordena só o topo, continuando de onde o quadro parou", () => {
    const existing = [
      existingRow({ id: "a", code_number: 4, order: 0 }),
      existingRow({ id: "b", code_number: 9, order: 1 }),
      existingRow({ id: "c", parent_objective_id: "a", column_id: null, code_number: null }),
    ];
    const rows = buildObjectiveTreeRows([leaf("Um"), leaf("Dois")], { columnId: COLUMN, existing, newId: ids() });

    assert.deepEqual(rows.map((r) => [r.title, r.code_number, r.order, r.column_id]), [
      ["Um", 10, 2, COLUMN],
      ["Dois", 11, 3, COLUMN],
    ]);
  });

  it("filhos ficam sem coluna e sem código, com ordem entre irmãos e kind task", () => {
    const rows = buildObjectiveTreeRows(
      [leaf("Obj", { children: [leaf("Marco A"), leaf("Marco B", { children: [leaf("Issue", { children: [leaf("Sub")] })] })] })],
      { columnId: COLUMN, existing: [], newId: ids() },
    );
    const byTitle = Object.fromEntries(rows.map((r) => [r.title, r]));

    assert.equal(rows.length, 5);
    assert.equal(byTitle["Marco A"].parent_objective_id, byTitle["Obj"].id);
    assert.equal(byTitle["Marco B"].parent_objective_id, byTitle["Obj"].id);
    assert.equal(byTitle["Sub"].parent_objective_id, byTitle["Issue"].id);
    assert.deepEqual([byTitle["Marco A"].order, byTitle["Marco B"].order], [0, 1]);
    for (const title of ["Marco A", "Marco B", "Issue", "Sub"]) {
      assert.equal(byTitle[title].column_id, null);
      assert.equal(byTitle[title].code_number, null);
      assert.equal(byTitle[title].kind, "task");
    }
    assert.equal(byTitle["Obj"].kind, "objective");
  });

  it("progresso do pai é a média dos filhos, subindo a árvore (folha feita = 100)", () => {
    const rows = buildObjectiveTreeRows(
      [
        leaf("Obj", {
          children: [
            leaf("Marco 1", { children: [leaf("a", { done: true }), leaf("b"), leaf("c"), leaf("d")] }),
            leaf("Marco 2", { children: [leaf("e")] }),
          ],
        }),
      ],
      { columnId: COLUMN, existing: [], newId: ids() },
    );
    const progress = Object.fromEntries(rows.map((r) => [r.title, r.progress]));

    assert.equal(progress["Marco 1"], 25);
    assert.equal(progress["Marco 2"], 0);
    assert.equal(progress["Obj"], 13); // (25 + 0) / 2 = 12,5 → 13, igual ao Math.round do resto do app
  });

  it("área sem valor herda a do pai; prioridade não herda", () => {
    const rows = buildObjectiveTreeRows(
      [leaf("Obj", { area: "vendas", priority: "critica", children: [leaf("Filho"), leaf("Outro", { area: "marketing" })] })],
      { columnId: COLUMN, existing: [], newId: ids() },
    );
    const byTitle = Object.fromEntries(rows.map((r) => [r.title, r]));

    assert.equal(byTitle["Filho"].area, "vendas");
    assert.equal(byTitle["Outro"].area, "marketing");
    assert.equal(byTitle["Filho"].priority, null);
    assert.equal(byTitle["Obj"].priority, "critica");
  });

  it("tarefa avulsa no topo mantém kind task e ganha código", () => {
    const [row] = buildObjectiveTreeRows([leaf("Falar com X", { kind: "task" })], {
      columnId: COLUMN,
      existing: [],
      newId: ids(),
    });
    assert.equal(row.kind, "task");
    assert.equal(row.code_number, 1);
  });

  it("recusa nível a mais, área/prioridade inválidas, título vazio e lista vazia", () => {
    const opts = { columnId: COLUMN, existing: [], newId: ids() };
    const deep = leaf("0", { children: [leaf("1", { children: [leaf("2", { children: [leaf("3", { children: [leaf("4")] })] })] })] });

    assert.throws(() => buildObjectiveTreeRows([deep], opts), /Limite de níveis/);
    assert.throws(() => buildObjectiveTreeRows([leaf("x", { area: "rh" })], opts), /Área inválida/);
    assert.throws(() => buildObjectiveTreeRows([leaf("x", { priority: "urgente" })], opts), /Prioridade inválida/);
    assert.throws(() => buildObjectiveTreeRows([leaf("  ")], opts), /título/);
    assert.throws(() => buildObjectiveTreeRows([], opts), /nenhum item/);
  });

  it("aceita exatamente 3 níveis abaixo do objetivo", () => {
    const tree = leaf("0", { children: [leaf("1", { children: [leaf("2", { children: [leaf("3")] })] })] });
    assert.equal(buildObjectiveTreeRows([tree], { columnId: COLUMN, existing: [], newId: ids() }).length, 4);
  });
});
