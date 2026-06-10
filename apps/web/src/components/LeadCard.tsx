import { useDraggable } from "@dnd-kit/core";
import { Instagram, MapPin, Phone, Star } from "lucide-react";
import type { Lead } from "@/types";
import { useLeadModalStore } from "@/store/leadModal";

interface LeadCardProps {
  lead: Lead;
  overlay?: boolean;
}

export function LeadCard({ lead, overlay = false }: LeadCardProps) {
  const open = useLeadModalStore((s) => s.open);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
    disabled: overlay,
  });

  const hasPhone = lead.phone && lead.phone !== "";

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={(e) => {
        if (overlay || isDragging) return;
        e.stopPropagation();
        open(lead.id);
      }}
      className={`group relative rounded-lg border bg-card p-3 shadow-sm transition-[border-color,box-shadow,opacity,transform] touch-none select-none
        ${
          overlay
            ? "cursor-grabbing shadow-xl ring-2 ring-primary/40 rotate-1 scale-[1.02] border-primary/30"
            : "cursor-grab active:cursor-grabbing hover:border-primary/30 hover:shadow-md hover:-translate-y-px border-border"
        }
        ${isDragging && !overlay ? "opacity-20 scale-95" : ""}`}
    >
      {/* Drag handle hint */}
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-lg opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "oklch(0.6 0.15 260 / 0.5)" }} />

      {/* Name + category */}
      <div className="pl-0.5">
        <h4 className="text-sm font-semibold leading-snug truncate pr-1">{lead.companyName}</h4>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{lead.category}</p>
      </div>

      {/* Score + city */}
      <div className="mt-2.5 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Star className="h-3 w-3 fill-warning text-warning shrink-0" />
        <span className="font-semibold text-foreground tabular-nums">{lead.score}</span>
        <span className="mx-1 opacity-40">•</span>
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate">{lead.city}</span>
      </div>

      {/* Instagram + phone */}
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
        {lead.instagram ? (
          <span className="inline-flex items-center gap-1 truncate flex-1 min-w-0">
            <Instagram className="h-3 w-3 shrink-0 text-pink-500" />
            <span className="truncate">{lead.instagram}</span>
          </span>
        ) : (
          <span className="flex-1" />
        )}
        {hasPhone && (
          <span className="inline-flex items-center gap-1 shrink-0 text-green-600">
            <Phone className="h-3 w-3" />
          </span>
        )}
      </div>

      {/* Tags */}
      {lead.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground"
            >
              {t}
            </span>
          ))}
          {lead.tags.length > 3 && (
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground">
              +{lead.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/50 pt-1.5">
        <span className="truncate">{lead.owner.split(" ")[0]}</span>
        <span className="shrink-0 ml-2">{lead.lastInteraction}</span>
      </div>
    </div>
  );
}
