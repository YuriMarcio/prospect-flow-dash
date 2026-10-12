import { useEffect, useState } from "react";
import { CalendarClock, Plus, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { isSubIssueDone, type Objective } from "@/lib/objectives";

export function SubIssueList({
  subIssues,
  assigneeNameById,
  onCreate,
  onToggle,
  onRename,
  onDelete,
}: {
  subIssues: Objective[];
  assigneeNameById: Record<string, string>;
  onCreate: (title: string) => void;
  onToggle: (subIssue: Objective, done: boolean) => void;
  onRename: (subIssue: Objective, title: string) => void;
  onDelete: (subIssue: Objective) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const doneCount = subIssues.filter(isSubIssueDone).length;

  function submit() {
    const title = newTitle.trim();
    if (!title) return;
    onCreate(title);
    setNewTitle("");
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Sub-issues</Label>
        {subIssues.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {doneCount}/{subIssues.length}
          </span>
        )}
      </div>

      {subIssues.length > 0 && (
        <ul className="space-y-0.5">
          {subIssues.map((subIssue) => (
            <SubIssueRow
              key={subIssue.id}
              subIssue={subIssue}
              assigneeName={subIssue.assignedUserId ? assigneeNameById[subIssue.assignedUserId] : null}
              onToggle={onToggle}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-1.5 focus-within:border-foreground/40">
        <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Adicionar sub-issue..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}

function SubIssueRow({
  subIssue,
  assigneeName,
  onToggle,
  onRename,
  onDelete,
}: {
  subIssue: Objective;
  assigneeName?: string | null;
  onToggle: (subIssue: Objective, done: boolean) => void;
  onRename: (subIssue: Objective, title: string) => void;
  onDelete: (subIssue: Objective) => void;
}) {
  const [title, setTitle] = useState(subIssue.title);
  const done = isSubIssueDone(subIssue);

  useEffect(() => setTitle(subIssue.title), [subIssue.title]);

  function commitTitle() {
    const next = title.trim();
    if (!next) {
      setTitle(subIssue.title);
      return;
    }
    if (next !== subIssue.title) onRename(subIssue, next);
  }

  // Data "YYYY-MM-DD" parseada como local — `new Date("2026-10-12")` seria UTC e mostraria o dia anterior no Brasil.
  const dueLabel = subIssue.dueDate
    ? new Date(`${subIssue.dueDate.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      })
    : null;

  return (
    <li className="group/sub flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent/50">
      <Checkbox
        checked={done}
        onCheckedChange={(checked) => onToggle(subIssue, checked === true)}
        aria-label={done ? "Marcar sub-issue como pendente" : "Marcar sub-issue como concluída"}
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={cn(
          "min-w-0 flex-1 bg-transparent text-sm outline-none",
          done && "text-muted-foreground line-through",
        )}
      />
      {dueLabel && (
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
          <CalendarClock className="h-3 w-3" />
          {dueLabel}
        </span>
      )}
      {assigneeName && (
        <span
          title={assigneeName}
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-medium text-primary"
        >
          {assigneeName.slice(0, 2).toUpperCase()}
        </span>
      )}
      <button
        type="button"
        onClick={() => onDelete(subIssue)}
        aria-label="Excluir sub-issue"
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:opacity-100 md:opacity-0 md:group-hover/sub:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </li>
  );
}
