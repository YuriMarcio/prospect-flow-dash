import { AlertTriangle, CheckCircle2, Info, Lightbulb, XCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EditableBlockText } from "./EditableBlockText";
import { cn } from "@/lib/utils";
import type { Block, CalloutKind } from "@/lib/workspaceTypes";

const KIND_CONFIG: Record<CalloutKind, { icon: typeof Info; cls: string; label: string }> = {
  idea: { icon: Lightbulb, cls: "bg-primary/10 border-primary/30 text-primary", label: "Ideia" },
  info: { icon: Info, cls: "bg-info/10 border-info/30 text-info", label: "Informação" },
  warning: {
    icon: AlertTriangle,
    cls: "bg-warning/10 border-warning/30 text-warning-foreground dark:text-warning",
    label: "Atenção",
  },
  success: { icon: CheckCircle2, cls: "bg-success/10 border-success/30 text-success", label: "Sucesso" },
  error: { icon: XCircle, cls: "bg-destructive/10 border-destructive/30 text-destructive", label: "Erro" },
};

export function CalloutBlock({
  block,
  onChangeTitle,
  onChangeBody,
  onChangeKind,
  onKeyDown,
}: {
  block: Block;
  onChangeTitle: (text: string) => void;
  onChangeBody: (text: string) => void;
  onChangeKind: (kind: CalloutKind) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  const kind = block.calloutKind ?? "idea";
  const { icon: Icon, cls } = KIND_CONFIG[kind];

  return (
    <div className={cn("rounded-lg border p-4 flex gap-3", cls)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="shrink-0 mt-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
            <Icon className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(Object.keys(KIND_CONFIG) as CalloutKind[]).map((k) => {
            const KIcon = KIND_CONFIG[k].icon;
            return (
              <DropdownMenuItem key={k} onClick={() => onChangeKind(k)}>
                <KIcon className="h-3.5 w-3.5" />
                {KIND_CONFIG[k].label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="min-w-0 flex-1 space-y-1 text-foreground">
        <EditableBlockText
          blockId={`${block.id}-title`}
          content={block.title ?? ""}
          placeholder="Título (opcional)"
          className="font-semibold text-sm"
          onInput={onChangeTitle}
          onKeyDown={onKeyDown}
        />
        <EditableBlockText
          blockId={`${block.id}-body`}
          content={block.content}
          placeholder="Escreva o callout…"
          className="text-sm text-muted-foreground"
          onInput={onChangeBody}
          onKeyDown={onKeyDown}
        />
      </div>
    </div>
  );
}
