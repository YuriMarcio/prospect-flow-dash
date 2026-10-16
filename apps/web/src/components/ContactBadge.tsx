import { AlertTriangle, CalendarClock, CheckCheck, CircleDashed, Clock, MessageCircle } from "lucide-react";
import type { Lead } from "@/types";
import { cn } from "@/lib/utils";
import { leadSituation, type ContactState, type LeadBot } from "@/components/prospector/campaign-panel/leadDisplay";

const ICONS: Record<ContactState, typeof Clock | null> = {
  none: CircleDashed,
  planned: CalendarClock,
  queued: Clock,
  contacted: CheckCheck,
  replied: MessageCircle,
  failed: AlertTriangle,
  stage: null,
};

/** "Já falei / ainda não falei" do lead: um chip com ícone, igual em todas as telas. */
export function ContactBadge({ lead, bot, className }: { lead: Lead; bot?: LeadBot; className?: string }) {
  const situation = leadSituation(lead, bot);
  const Icon = ICONS[situation.state];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium",
        situation.className,
        className,
      )}
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      <span className="truncate">{situation.label}</span>
    </span>
  );
}
