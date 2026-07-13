import { useRef, useState } from "react";
import { ImagePlus, MoreHorizontal, Share2, Smile, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useWorkspaceStore } from "@/store/workspace";
import type { WorkspacePage } from "@/lib/workspaceTypes";
import { CURRENT_USER, OTHER_USER } from "@/lib/workspaceTypes";
import { useTimeAgo } from "@/lib/workspaceUtils";
import { BlockList } from "./BlockList";
import { cn } from "@/lib/utils";

const ICONS = ["🚀", "📄", "📁", "📝", "💡", "📊", "🎯", "🔥", "🧠", "📚", "💬", "🛠️", "✅", "📌", "📈", "🗂️"];

export function DocumentEditor({
  page,
  breadcrumb,
  onDelete,
  onNavigate,
  focusMode,
  onToggleFocus,
}: {
  page: WorkspacePage;
  breadcrumb: string[];
  onDelete: () => void;
  onNavigate: (id: string) => void;
  focusMode: boolean;
  onToggleFocus: () => void;
}) {
  const updatePageMeta = useWorkspaceStore((s) => s.updatePageMeta);
  const toggleFavorite = useWorkspaceStore((s) => s.toggleFavorite);
  const [cover, setCover] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const updatedLabel = useTimeAgo(page.updatedAt);

  return (
    <div className="mx-auto w-full max-w-225 px-8 py-10">
      {cover && (
        <div className="relative -mx-8 -mt-10 mb-8 h-48 group/cover">
          <img src={cover} alt="" className="w-full h-full object-cover" />
          <button
            onClick={() => setCover(null)}
            className="absolute top-3 right-3 hidden group-hover/cover:flex items-center gap-1 rounded-md bg-background/80 border border-border px-2 py-1 text-xs"
          >
            <Trash2 className="h-3 w-3" />
            Remover capa
          </button>
        </div>
      )}

      <div className="text-xs text-muted-foreground flex items-center gap-1 mb-4 flex-wrap">
        {breadcrumb.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="opacity-50">/</span>}
            <span className={i === breadcrumb.length - 1 ? "text-foreground font-medium" : ""}>{crumb}</span>
          </span>
        ))}
      </div>

      <div className="group/header flex items-start justify-between gap-4 mb-1">
        <div className="flex items-center gap-2 opacity-0 group-hover/header:opacity-100 transition-opacity">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                <Smile className="h-3.5 w-3.5" />
                Adicionar ícone
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <div className="grid grid-cols-8 gap-1">
                {ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => updatePageMeta(page.id, { icon })}
                    className="h-7 w-7 grid place-items-center rounded hover:bg-accent text-base"
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {!cover && (
            <>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setCover(URL.createObjectURL(file));
                }}
              />
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => coverInputRef.current?.click()}>
                <ImagePlus className="h-3.5 w-3.5" />
                Adicionar capa
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center -space-x-2 mr-2">
            <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold grid place-items-center border-2 border-background">
              {CURRENT_USER.initials}
            </div>
            <div className="h-7 w-7 rounded-full bg-info text-white text-[10px] font-semibold grid place-items-center border-2 border-background">
              {OTHER_USER.initials}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleFavorite(page.id)}>
            <Star className={cn("h-4 w-4", page.favorite && "fill-warning text-warning")} />
          </Button>
          <Button variant="outline" size="sm" className="h-8">
            <Share2 className="h-3.5 w-3.5" />
            Compartilhar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onToggleFocus}>{focusMode ? "Sair do modo foco" : "Modo foco"}</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
                Excluir página
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="text-5xl mb-2 leading-none">{page.icon}</div>

      <input
        value={page.title}
        onChange={(e) => updatePageMeta(page.id, { title: e.target.value })}
        placeholder="Sem título"
        className="w-full bg-transparent outline-none text-[40px] font-bold tracking-tight placeholder:text-muted-foreground/50 mb-2"
      />

      <input
        value={page.description}
        onChange={(e) => updatePageMeta(page.id, { description: e.target.value })}
        placeholder="Adicione uma descrição…"
        className="w-full bg-transparent outline-none text-sm text-muted-foreground mb-3"
      />

      <div className="flex items-center gap-2 mb-8 text-xs text-muted-foreground">
        <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[9px] font-semibold grid place-items-center">
          {CURRENT_USER.initials}
        </div>
        Última edição {updatedLabel} por {page.updatedBy}
      </div>

      <BlockList page={page} onNavigate={onNavigate} />
    </div>
  );
}
