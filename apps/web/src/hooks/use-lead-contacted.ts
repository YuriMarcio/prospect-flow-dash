import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateLead } from "@/lib/api";
import { useKanbanStore } from "@/store/kanban";
import type { Lead } from "@/types";

// Mesmas colunas que o disparador usa: "A Prospectar" (col-1) → "Em Prospecção" (col-2) ao contatar
const NEW_COLUMN = "col-1";
const CONTACTED_COLUMN = "col-2";

/**
 * Marca à mão que o lead já foi contatado (ou desfaz). É o mesmo estado que o bot grava ao enviar a
 * primeira mensagem — status "contato" — então a lista, os filtros e o Kanban passam a tratá-lo como contatado.
 */
export function useLeadContacted() {
  const queryClient = useQueryClient();
  const patchStore = useKanbanStore((s) => s.updateLead);

  const mutation = useMutation({
    mutationFn: ({ lead, contacted }: { lead: Lead; contacted: boolean }) =>
      updateLead(lead.id, contacted ? { status: "contato", columnId: CONTACTED_COLUMN } : { status: "novo", columnId: NEW_COLUMN }),
    onMutate: ({ lead, contacted }) => {
      const previous = { status: lead.status, columnId: lead.columnId };
      patchStore(lead.id, contacted ? { status: "contato", columnId: CONTACTED_COLUMN } : { status: "novo", columnId: NEW_COLUMN });
      return previous;
    },
    onError: (error, { lead }, previous) => {
      if (previous) patchStore(lead.id, previous);
      toast.error("Não foi possível atualizar o contato", { description: error instanceof Error ? error.message : undefined });
    },
    onSettled: (_data, _error, { lead }) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      if (lead.prospectingCampaignId) {
        queryClient.invalidateQueries({ queryKey: ["campaign-leads", lead.prospectingCampaignId] });
        queryClient.invalidateQueries({ queryKey: ["bot-queue", lead.prospectingCampaignId] });
        queryClient.invalidateQueries({ queryKey: ["campaign-status", lead.prospectingCampaignId] });
      }
    },
  });

  function setContacted(lead: Lead, contacted: boolean, options: { silent?: boolean } = {}) {
    mutation.mutate({ lead, contacted });
    if (options.silent) return;
    if (contacted) {
      toast.success(`${lead.companyName} marcado como contatado`, {
        action: { label: "Desfazer", onClick: () => mutation.mutate({ lead, contacted: false }) },
      });
    } else {
      toast.success(`${lead.companyName} voltou para "Sem contato"`);
    }
  }

  return { setContacted, isPending: mutation.isPending };
}
