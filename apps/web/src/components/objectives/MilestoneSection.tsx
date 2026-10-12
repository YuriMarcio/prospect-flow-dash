import { useEffect, useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Objective } from "@/lib/objectives";
import { isDone } from "@/lib/objectiveTree";
import { pluralize } from "@/lib/objectiveMeta";

export interface TreeActions {
  onCreate: (parentId: string, title: string) => void;
  onToggle: (node: Objective, done: boolean) => void;
  onRename: (node: Objective, title: string) => void;
  onDelete: (node: Objective) => void;
}

type ChildrenOf = (id: string) => Objective[];

function statusLabel(node: Objective) {
  if (isDone(node)) return "Concluído";
  return node.progress > 0 ? "Em progresso" : "A fazer";
}

/** Marcos de entrega de um objetivo: marco → issues → subissues. */
export function MilestoneSection({
  objective,
  childrenOf,
  ...actions
}: { objective: Objective; childrenOf: ChildrenOf } & TreeActions) {
  const [addingMilestone, setAddingMilestone] = useState(false);
  const milestones = childrenOf(objective.id);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Marcos de entrega</h3>
          <p className="text-xs text-muted-foreground">Milestones → Issues → Subissues</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setAddingMilestone(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Novo marco
        </Button>
      </div>

      {addingMilestone && (
        <InlineAdd
          placeholder="Nome do marco e Enter"
          onSubmit={(title) => actions.onCreate(objective.id, title)}
          onClose={() => setAddingMilestone(false)}
          className="rounded-lg border border-border bg-card px-3 py-2"
        />
      )}

      {milestones.length === 0 && !addingMilestone && (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
          Nenhum marco ainda. Quebre o objetivo em marcos de entrega para acompanhar o progresso.
        </p>
      )}

      {milestones.map((milestone) => (
        <MilestoneCard key={milestone.id} milestone={milestone} childrenOf={childrenOf} {...actions} />
      ))}
    </section>
  );
}

function MilestoneCard({
  milestone,
  childrenOf,
  ...actions
}: { milestone: Objective; childrenOf: ChildrenOf } & TreeActions) {
  const [expanded, setExpanded] = useState(true);
  const [addingIssue, setAddingIssue] = useState(false);
  const issues = childrenOf(milestone.id);
  const hasIssues = issues.length > 0;
  const done = isDone(milestone);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="group/header flex items-start gap-3 px-3.5 pt-3.5">
        {/* Com issues o marco é derivado delas; sem issues, o círculo marca o marco direto. */}
        <button
          type="button"
          disabled={hasIssues}
          onClick={() => actions.onToggle(milestone, !done)}
          aria-label={done ? "Marcar marco como pendente" : "Marcar marco como concluído"}
          className={cn(
            "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
            done ? "border-success bg-success text-success-foreground" : "border-muted-foreground/40",
            hasIssues ? "cursor-default" : "cursor-pointer hover:border-primary",
          )}
        >
          {done && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>

        <div className="min-w-0 flex-1">
          <InlineTitle node={milestone} onRename={actions.onRename} className="text-sm font-semibold" />
          <p className="text-[11px] text-muted-foreground">
            {hasIssues ? pluralize(issues.length, "issue", "issues") : "Sem issues"} · {statusLabel(milestone)}
          </p>
        </div>

        <span className="pt-0.5 text-xs font-semibold">{milestone.progress}%</span>
        <DeleteButton label="Excluir marco" reveal="header" onClick={() => actions.onDelete(milestone)} />
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? "Recolher marco" : "Expandir marco"}
          aria-expanded={expanded}
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", !expanded && "-rotate-90")} />
        </button>
      </div>

      <Progress value={milestone.progress} className="mx-3.5 mb-3.5 mt-3 h-1 w-auto" />

      {expanded && (
        <div className="border-t border-border px-3.5 py-2">
          {issues.map((issue) => (
            <IssueRow key={issue.id} issue={issue} childrenOf={childrenOf} {...actions} />
          ))}

          {addingIssue ? (
            <InlineAdd
              placeholder="Nome da issue e Enter"
              onSubmit={(title) => actions.onCreate(milestone.id, title)}
              onClose={() => setAddingIssue(false)}
              className="my-1.5 px-1"
            />
          ) : (
            <button
              type="button"
              onClick={() => setAddingIssue(true)}
              className="flex items-center gap-1 py-2 text-xs font-medium text-primary hover:underline"
            >
              <Plus className="h-3 w-3" />
              Nova issue
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function IssueRow({
  issue,
  childrenOf,
  ...actions
}: { issue: Objective; childrenOf: ChildrenOf } & TreeActions) {
  const [addingSubIssue, setAddingSubIssue] = useState(false);
  const subIssues = childrenOf(issue.id);

  return (
    <div className="border-b border-dashed border-border last:border-b-0">
      <div className="group/row flex items-center gap-2.5 py-2">
        <Checkbox
          checked={isDone(issue)}
          disabled={subIssues.length > 0}
          onCheckedChange={(checked) => actions.onToggle(issue, checked === true)}
          aria-label={isDone(issue) ? "Marcar issue como pendente" : "Marcar issue como concluída"}
        />
        <InlineTitle node={issue} onRename={actions.onRename} className={cn("text-sm", isDone(issue) && "text-muted-foreground line-through")} />
        <button
          type="button"
          onClick={() => setAddingSubIssue(true)}
          className="flex shrink-0 items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          subissue
        </button>
        <DeleteButton label="Excluir issue" onClick={() => actions.onDelete(issue)} />
      </div>

      {(subIssues.length > 0 || addingSubIssue) && (
        <div className="mb-1.5 ml-7 space-y-0.5 border-l border-border pl-3">
          {subIssues.map((subIssue) => (
            <div key={subIssue.id} className="group/row flex items-center gap-2.5 py-1">
              <Checkbox
                checked={isDone(subIssue)}
                onCheckedChange={(checked) => actions.onToggle(subIssue, checked === true)}
                aria-label={isDone(subIssue) ? "Marcar subissue como pendente" : "Marcar subissue como concluída"}
              />
              <InlineTitle
                node={subIssue}
                onRename={actions.onRename}
                className={cn("text-[13px]", isDone(subIssue) && "text-muted-foreground line-through")}
              />
              <DeleteButton label="Excluir subissue" onClick={() => actions.onDelete(subIssue)} />
            </div>
          ))}
          {addingSubIssue && (
            <InlineAdd
              placeholder="Nome da subissue e Enter"
              onSubmit={(title) => actions.onCreate(issue.id, title)}
              onClose={() => setAddingSubIssue(false)}
              className="py-1"
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Título editável direto na linha — Enter ou sair do campo salva; vazio volta ao anterior. */
function InlineTitle({
  node,
  onRename,
  className,
}: {
  node: Objective;
  onRename: (node: Objective, title: string) => void;
  className?: string;
}) {
  const [title, setTitle] = useState(node.title);

  useEffect(() => setTitle(node.title), [node.title]);

  function commit() {
    const next = title.trim();
    if (!next) {
      setTitle(node.title);
      return;
    }
    if (next !== node.title) onRename(node, next);
  }

  return (
    <input
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      aria-label="Título"
      className={cn("block w-full min-w-0 flex-1 bg-transparent outline-none", className)}
    />
  );
}

/**
 * Campo de criação rápida: Enter cria e continua aberto pro próximo item;
 * sair do campo cria o que estiver digitado (se houver) e fecha.
 */
function InlineAdd({
  placeholder,
  onSubmit,
  onClose,
  className,
}: {
  placeholder: string;
  onSubmit: (title: string) => void;
  onClose: () => void;
  className?: string;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const title = value.trim();
    if (!title) return;
    onSubmit(title);
    setValue("");
  }

  return (
    <div className={className}>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        onBlur={() => {
          submit();
          onClose();
        }}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

// Classes completas (não montadas por template) pro Tailwind enxergar. No celular o X fica sempre visível.
const REVEAL = {
  header: "md:opacity-0 md:group-hover/header:opacity-100",
  row: "md:opacity-0 md:group-hover/row:opacity-100",
};

function DeleteButton({
  label,
  onClick,
  reveal = "row",
}: {
  label: string;
  onClick: () => void;
  reveal?: keyof typeof REVEAL;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:opacity-100",
        REVEAL[reveal],
      )}
    >
      <X className="h-3 w-3" />
    </button>
  );
}
