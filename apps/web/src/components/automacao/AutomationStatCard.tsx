import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutomationStatCardProps {
  label: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
  accent: "primary" | "success" | "info" | "warning";
}

const accentClasses = {
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  info: "bg-info/15 text-info",
  warning: "bg-warning/20 text-warning-foreground dark:text-warning",
};

const subtitleClasses = {
  primary: "text-primary",
  success: "text-success",
  info: "text-info",
  warning: "text-warning-foreground dark:text-warning",
};

export function AutomationStatCard({ label, value, subtitle, icon: Icon, accent }: AutomationStatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
    >
      <div className={cn("h-11 w-11 shrink-0 rounded-lg grid place-items-center", accentClasses[accent])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground truncate">{label}</p>
        <p className="text-2xl font-semibold tracking-tight leading-tight">{value}</p>
        <p className={cn("text-xs font-medium", subtitleClasses[accent])}>{subtitle}</p>
      </div>
    </motion.div>
  );
}
