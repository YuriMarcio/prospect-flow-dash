import { cn } from "@/lib/utils";
import type { AutomationLogo } from "./automationOptions";

export function AutomationLogoBadge({ logo, className }: { logo: AutomationLogo; className?: string }) {
  if (logo.kind === "image") {
    return (
      <div className={cn("shrink-0 rounded-full overflow-hidden grid place-items-center", logo.bg, className)}>
        <img
          src={logo.src}
          alt=""
          className={cn("h-full w-full", logo.fit === "contain" ? "object-contain p-1.5" : "object-cover")}
        />
      </div>
    );
  }

  return (
    <div className={cn("shrink-0 rounded-full grid place-items-center", logo.bg, className)}>
      <logo.icon className="h-1/2 w-1/2 text-white" />
    </div>
  );
}
