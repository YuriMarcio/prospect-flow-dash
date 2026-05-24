import { useDraggable } from "@dnd-kit/core";
import { motion } from "motion/react";
import { Instagram, Phone, MapPin, Star, GripVertical } from "lucide-react";
import type { Lead } from "@/types";
import { useLeadModalStore } from "@/store/leadModal";

interface LeadCardProps {
  lead: Lead;
  /** Renderização "fantasma" usada dentro do DragOverlay (sem listeners). */
  overlay?: boolean;
}

export function LeadCard({ lead, overlay = false }: LeadCardProps) {
  const open = useLeadModalStore((s) => s.open);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
    disabled: overlay,
  });

  return (
    <motion.div
      ref={overlay ? undefined : setNodeRef}
      layout={!overlay}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={(e) => {
        if (overlay || isDragging) return;
        e.stopPropagation();
        open(lead.id);
      }}
      whileHover={overlay ? undefined : { y: -2 }}
      className={`group relative rounded-xl border border-border bg-card p-3 shadow-sm transition-all touch-none select-none
        ${overlay
          ? "cursor-grabbing shadow-2xl ring-2 ring-primary/50 rotate-2 scale-[1.02]"
          : "cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-md"}
        ${isDragging && !overlay ? "opacity-30" : ""}`}
    >
      <GripVertical
        className="absolute right-1 top-1 h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-hidden
      />
      <div className="flex items-start justify-between gap-2 pr-4">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold truncate">{lead.companyName}</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">{lead.category}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Star className="h-3 w-3 fill-warning text-warning" />
        <span className="font-medium text-foreground">{lead.score}</span>
        <span className="mx-1">•</span>
        <MapPin className="h-3 w-3" />
        <span className="truncate">{lead.city}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        {lead.instagram && (
          <span className="inline-flex items-center gap-1 truncate">
            <Instagram className="h-3 w-3" /> {lead.instagram}
          </span>
        )}
        <span className="inline-flex items-center gap-1 ml-auto">
          <Phone className="h-3 w-3" />
        </span>
      </div>
      {lead.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{lead.owner.split(" ")[0]}</span>
        <span>{lead.lastInteraction}</span>
      </div>
    </motion.div>
  );
}
