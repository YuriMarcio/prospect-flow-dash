import { FileText } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useWorkspaceStore } from "@/store/workspace";
import { useWorkspaceSync } from "@/hooks/use-workspace-sync";
import type { WorkspacePage } from "@/lib/workspaceTypes";

export function WorkspacePagePicker({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (pageId: string, pageTitle: string) => void;
}) {
  useWorkspaceSync();
  const pages = useWorkspaceStore((s) => s.pages);
  const list = Object.values(pages);

  function pathLabel(page: WorkspacePage): string {
    const parts: string[] = [];
    let current = page.parentId ? pages[page.parentId] : undefined;
    while (current) {
      parts.unshift(current.title || "Sem título");
      current = current.parentId ? pages[current.parentId] : undefined;
    }
    return parts.join(" / ");
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar página do Workspace…" />
      <CommandList>
        <CommandEmpty>Nenhuma página encontrada.</CommandEmpty>
        <CommandGroup heading="Páginas">
          {list.map((page) => {
            const path = pathLabel(page);
            return (
              <CommandItem
                key={page.id}
                value={`${page.title} ${path}`}
                onSelect={() => onSelect(page.id, page.title || "Sem título")}
                className="flex items-start gap-2"
              >
                <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{page.title || "Sem título"}</span>
                  {path && <span className="text-xs text-muted-foreground truncate">{path}</span>}
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
