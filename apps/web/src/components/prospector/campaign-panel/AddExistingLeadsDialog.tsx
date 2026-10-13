import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addLeadsToCampaign } from "@/lib/prospector";
import { useKanbanStore } from "@/store/kanban";
import { formatPhone } from "./leadDisplay";

/** Traz para o painel da campanha leads que estavam soltos no Kanban geral (ex.: capturas antigas). */
export function AddExistingLeadsDialog({
  open,
  onOpenChange,
  campaignId,
  defaultCity,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  defaultCity?: string;
}) {
  const queryClient = useQueryClient();
  const leads = useKanbanStore((s) => s.leads);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Soltos (sem campanha), ainda em "A Prospectar" e com WhatsApp — só esses fazem sentido pro bot
  const loose = useMemo(
    () => leads.filter((lead) => !lead.prospectingCampaignId && lead.status === "novo" && lead.phone),
    [leads],
  );
  const cities = useMemo(() => [...new Set(loose.map((lead) => lead.city))].sort((a, b) => a.localeCompare(b)), [loose]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return loose.filter(
      (lead) =>
        (city === "all" || lead.city === city) &&
        (!query || lead.companyName.toLowerCase().includes(query) || lead.phone.includes(query)),
    );
  }, [loose, search, city]);

  const allVisibleSelected = visible.length > 0 && visible.every((lead) => selected.has(lead.id));

  const mutation = useMutation({
    mutationFn: () => addLeadsToCampaign(campaignId, [...selected]),
    onSuccess: ({ added, skipped }) => {
      toast.success(`${added} lead${added === 1 ? "" : "s"} adicionado${added === 1 ? "" : "s"} à campanha`, {
        description: skipped.length > 0 ? `${skipped.length} não entraram: ${skipped[0].reason}` : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-leads"] });
      setSelected(new Set());
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error("Não foi possível adicionar os leads", {
        description: error instanceof Error ? error.message : undefined,
      }),
  });

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const lead of visible) {
        if (checked) next.add(lead.id);
        else next.delete(lead.id);
      }
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-4 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Adicionar leads do Kanban geral</DialogTitle>
          <DialogDescription>
            Leads que ainda não estão em nenhuma campanha. {defaultCity ? `Dica: filtre por “${defaultCity}”.` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou número…" className="h-9 pl-8" />
          </div>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as cidades</SelectItem>
              {cities.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-h-40 flex-1 overflow-y-auto rounded-lg border border-border">
          {visible.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {loose.length === 0 ? "Não há leads soltos disponíveis." : "Nenhum lead com esse filtro."}
            </p>
          ) : (
            <>
              <label className="sticky top-0 flex cursor-pointer items-center gap-3 border-b border-border bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground backdrop-blur">
                <Checkbox checked={allVisibleSelected} onCheckedChange={(checked) => toggleAllVisible(checked === true)} />
                Marcar todos os {visible.length} da lista
              </label>
              {visible.map((lead) => (
                <label
                  key={lead.id}
                  className="flex cursor-pointer items-center gap-3 border-b border-border/60 px-4 py-2.5 last:border-b-0 hover:bg-accent/40"
                >
                  <Checkbox checked={selected.has(lead.id)} onCheckedChange={(checked) => toggle(lead.id, checked === true)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{lead.companyName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {lead.category} · {lead.city}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatPhone(lead.phone)}</span>
                </label>
              ))}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={selected.size === 0 || mutation.isPending}>
            {mutation.isPending ? "Adicionando…" : `Adicionar ${selected.size || ""} à campanha`.replace("  ", " ")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
