import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: number;
  icon: LucideIcon;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "info";
}

const accentClasses = {
  primary: "from-primary/20 to-primary/0 text-primary",
  success: "from-success/20 to-success/0 text-success",
  warning: "from-warning/25 to-warning/0 text-warning-foreground dark:text-warning",
  info: "from-info/20 to-info/0 text-info",
};

export function MetricCard({ label, value, delta, icon: Icon, hint, accent = "primary" }: MetricCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="relative overflow-hidden rounded-xl border border-border bg-card p-5"
    >
      <div className={cn("absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br blur-2xl opacity-60", accentClasses[accent])} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("h-9 w-9 rounded-lg bg-gradient-to-br grid place-items-center", accentClasses[accent])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {delta !== undefined && (
        <div className="relative mt-3 inline-flex items-center gap-1 text-xs font-medium">
          <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5",
            positive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
          )}>
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
          <span className="text-muted-foreground">vs semana passada</span>
        </div>
      )}
    </motion.div>
  );
}
