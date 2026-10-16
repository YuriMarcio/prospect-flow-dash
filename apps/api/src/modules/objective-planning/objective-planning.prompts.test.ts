import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPlannerSystemInstruction, parsePlannerResponse, PLANNER_JSON_SCHEMA } from "./objective-planning.prompts";
import { resolveOwner, toTreeNode } from "./objective-planning.tree";
import { buildObjectiveTreeRows } from "../objectives/objective-tree";

type Schema = { type?: unknown; properties?: Record<string, Schema>; required?: string[]; items?: Schema; additionalProperties?: boolean };

/** Profundidade de objetos aninhados (a Groq no modo strict aceita até 5 níveis). */
function objectDepth(schema: Schema): number {
  if (schema.items) return objectDepth(schema.items);
  if (!schema.properties) return 0;
  return 1 + Math.max(0, ...Object.values(schema.properties).map(objectDepth));
}

function assertStrict(schema: Schema, path = "root") {
  if (schema.items) assertStrict(schema.items, `${path}[]`);
  if (!schema.properties) return;
  assert.equal(schema.additionalProperties, false, `${path}: additionalProperties deve ser false`);
  assert.deepEqual([...(schema.required ?? [])].sort(), Object.keys(schema.properties).sort(), `${path}: todas as chaves obrigatórias`);
  for (const [key, child] of Object.entries(schema.properties)) assertStrict(child, `${path}.${key}`);
}

describe("PLANNER_JSON_SCHEMA", () => {
  it("segue as regras do modo strict e não passa de 5 níveis de objeto", () => {
    const schema = PLANNER_JSON_SCHEMA.schema as Schema;
    assertStrict(schema);
    assert.ok(objectDepth(schema) <= 5, `profundidade ${objectDepth(schema)}`);
  });

  it("o objetivo aceita marco → issue → subissue e o último nível não tem `tasks`", () => {
    const objective = ((PLANNER_JSON_SCHEMA.schema as Schema).properties!.objectives.items)!;
    const marco = objective.properties!.tasks.items!;
    const issue = marco.properties!.tasks.items!;
    const subissue = issue.properties!.tasks.items!;
    assert.ok(objective.properties!.kind && objective.properties!.area && objective.properties!.priority && objective.properties!.done);
    assert.equal(subissue.properties!.tasks, undefined);
  });
});

describe("buildPlannerSystemInstruction", () => {
  it("ensina a hierarquia, a importação fiel de listas e o mapeamento P0/P1/P2", () => {
    const text = buildPlannerSystemInstruction([]);
    assert.match(text, /objetivo.*marco.*issue.*subissue/);
    assert.match(text, /IMPORTAR LISTA/);
    assert.match(text, /P0 → critica/);
    assert.match(text, /Nunca invente responsável nem prazo/);
  });
});

describe("parsePlannerResponse", () => {
  it("normaliza a árvore inteira e descarta área/prioridade fora da lista", () => {
    const response = parsePlannerResponse({
      assistantMessage: "ok",
      readyToConfirm: true,
      objectives: [
        {
          kind: "objective",
          title: "1.0 Comercial",
          area: "vendas",
          priority: "urgente",
          tasks: [{ title: "1.1 Estrutura", area: "rh", done: true, tasks: [{ title: "1.1.1 Política", tasks: [{ title: "sub" }] }] }],
        },
      ],
    });
    const [objective] = response.objectives;
    const marco = objective.tasks![0];
    const issue = marco.tasks![0];

    assert.equal(objective.area, "vendas");
    assert.equal(objective.priority, null);
    assert.equal(marco.area, null);
    assert.equal(marco.done, true);
    assert.equal(issue.tasks![0].title, "sub");
    assert.deepEqual(issue.tasks![0].tasks, []);
  });

  it("rascunho antigo (sem área/prioridade/done e sem tasks) continua válido", () => {
    const response = parsePlannerResponse({
      assistantMessage: "",
      readyToConfirm: false,
      objectives: [{ kind: "task", title: "Falar com Andrei", description: "", dueDate: null, owner: null, tasks: [] }],
    });
    assert.equal(response.assistantMessage, "Entendi.");
    assert.equal(response.objectives[0].kind, "task");
    assert.equal(response.objectives[0].done, false);
  });

  it("corta o que passar de 3 níveis abaixo do objetivo", () => {
    const deep = { title: "0", tasks: [{ title: "1", tasks: [{ title: "2", tasks: [{ title: "3", tasks: [{ title: "4" }] }] }] }] };
    const [objective] = parsePlannerResponse({ objectives: [deep] }).objectives;
    assert.equal(objective.tasks![0].tasks![0].tasks![0].title, "3");
    assert.deepEqual(objective.tasks![0].tasks![0].tasks![0].tasks, []);
  });
});

describe("rascunho da IA → itens do board", () => {
  it("responsável é casado com a equipe sem diferenciar acento e caixa", () => {
    const users = [{ id: "u1", name: "Andrei Souza", username: "andrei" }];
    assert.deepEqual(resolveOwner("ANDREI souza", users), { owner: "Andrei Souza", assignedUserId: "u1" });
    assert.deepEqual(resolveOwner("Fulano", users), { owner: "Fulano", assignedUserId: null });
    assert.deepEqual(resolveOwner(null, users), { owner: null, assignedUserId: null });
  });

  it("lista do EAP colada vira a árvore certa: níveis, códigos, área herdada e progresso", () => {
    const { objectives } = parsePlannerResponse({
      assistantMessage: "Montei o plano.",
      readyToConfirm: true,
      objectives: [
        {
          kind: "objective",
          title: "1.0 Comercial",
          area: "vendas",
          tasks: [
            {
              title: "1.1 Estrutura comercial preparada",
              tasks: [
                { title: "1.1.1 Política comercial aprovada", priority: "critica", done: true },
                { title: "1.1.2 Apresentação B2B finalizada", description: "Situação no EAP: Em produção.", priority: "critica" },
              ],
            },
            {
              title: "1.2 Prospecção estruturada",
              tasks: [{ title: "1.2.1 Mapa de comércios", tasks: [{ title: "Levantar lista de lojas" }, { title: "Priorizar por demanda" }] }],
            },
          ],
        },
        { kind: "objective", title: "2.0 Marketing", area: "marketing", tasks: [] },
      ],
    });

    let n = 0;
    const rows = buildObjectiveTreeRows(objectives.map((o) => toTreeNode(o, [])), {
      columnId: "col",
      existing: [],
      newId: () => `id-${++n}`,
    });
    const byTitle = Object.fromEntries(rows.map((r) => [r.title, r]));

    assert.equal(rows.length, 9);
    assert.deepEqual([byTitle["1.0 Comercial"].code_number, byTitle["2.0 Marketing"].code_number], [1, 2]);
    assert.equal(byTitle["1.1.1 Política comercial aprovada"].area, "vendas");
    assert.equal(byTitle["Levantar lista de lojas"].parent_objective_id, byTitle["1.2.1 Mapa de comércios"].id);
    assert.equal(byTitle["1.1 Estrutura comercial preparada"].progress, 50);
    assert.equal(byTitle["1.0 Comercial"].progress, 25); // (50 + 0) / 2
    assert.equal(byTitle["1.1.2 Apresentação B2B finalizada"].description, "Situação no EAP: Em produção.");
  });
});
