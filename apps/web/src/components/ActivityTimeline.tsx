import { Phone, FileText, MoveRight, UserPlus, Sparkles } from "lucide-react";
import type { TimelineEvent } from "@/types";
import { cn } from "@/lib/utils";

const iconMap = {
  call: Phone,
  note: FileText,
  move: MoveRight,
  contact: UserPlus,
  create: Sparkles,
} as const;

const colorMap = {
  call: "bg-info/15 text-info",
  note: "bg-muted text-foreground",
  move: "bg-warning/20 text-warning-foreground dark:text-warning",
  contact: "bg-primary/15 text-primary",
  create: "bg-success/15 text-success",
};

export function ActivityTimeline({ events, className }: { events: TimelineEvent[]; className?: string }) {
  return (
    <ol className={cn("relative space-y-4", className)}>
      <span className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
      {events.map((e) => {
        const Icon = iconMap[e.type];
        return (
          <li key={e.id} className="relative flex gap-3">
            <div className={cn("relative z-10 h-8 w-8 shrink-0 rounded-full grid place-items-center ring-4 ring-card", colorMap[e.type])}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 pt-0.5">
              <p className="text-sm font-medium leading-tight">{e.title}</p>
              {e.description && <p className="mt-0.5 text-xs text-muted-foreground">{e.description}</p>}
              <p className="mt-1 text-[11px] text-muted-foreground">{e.author} • {e.date}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
