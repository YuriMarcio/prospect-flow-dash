import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AutomationLogoBadge } from "./AutomationLogoBadge";
import type { AutomationOption } from "./automationOptions";

const badgeClasses = {
  primary: "bg-primary/15 text-primary",
  destructive: "bg-destructive/15 text-destructive",
  info: "bg-info/15 text-info",
};

export function AutomationOptionRow({
  option,
  onConfigure,
}: {
  option: AutomationOption;
  onConfigure: () => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
      <AutomationLogoBadge logo={option.logo} className="h-10 w-10" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold truncate">{option.title}</h3>
          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0", badgeClasses[option.accent])}>
            {option.subtitle}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{option.description}</p>
      </div>

      <div className="hidden md:flex items-center gap-4 text-[11px] text-muted-foreground shrink-0">
        <span>{option.stats.mediaLeads} leads</span>
        <span>{option.stats.tempoMedio}</span>
      </div>

      <Button size="sm" className="shrink-0" onClick={onConfigure}>
        <Rocket className="h-3.5 w-3.5" />
        {option.buttonLabel}
      </Button>
    </div>
  );
}
