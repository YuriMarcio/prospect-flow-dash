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

export function AutomationOptionCard({
  option,
  onConfigure,
}: {
  option: AutomationOption;
  onConfigure: () => void;
}) {
  return (
    <div className="relative flex flex-col rounded-xl border border-border bg-card p-5 gap-4 overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <AutomationLogoBadge logo={option.logo} className="h-11 w-11" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight">{option.title}</h3>
            <span
              className={cn(
                "inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full",
                badgeClasses[option.accent],
              )}
            >
              {option.subtitle}
            </span>
          </div>
        </div>
        <img
          src={option.heroSrc}
          alt=""
          className="h-20 w-20 object-contain shrink-0 -mt-3 -mr-2 pointer-events-none select-none"
        />
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{option.description}</p>

      <div className="flex flex-wrap gap-2">
        {option.pills.map((pill) => (
          <span
            key={pill.label}
            className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-full border border-border"
          >
            <span className={cn("h-4 w-4 shrink-0 rounded-full grid place-items-center", badgeClasses[option.accent])}>
              <pill.icon className="h-2.5 w-2.5" />
            </span>
            {pill.label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/30 p-3 text-[11px]">
        <div>
          <p className="text-muted-foreground">Fonte</p>
          <p className="font-medium truncate">{option.stats.fonte}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Média de leads</p>
          <p className="font-medium">{option.stats.mediaLeads}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Tempo médio</p>
          <p className="font-medium">{option.stats.tempoMedio}</p>
        </div>
      </div>

      <Button size="lg" className="mt-auto glow-primary" onClick={onConfigure}>
        <Rocket className="h-4 w-4" />
        {option.buttonLabel}
      </Button>
    </div>
  );
}
