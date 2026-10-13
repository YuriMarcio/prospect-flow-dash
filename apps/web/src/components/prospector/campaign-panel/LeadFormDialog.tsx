import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/automacao/Field";
import { createLead, getStatusForColumn, updateLead } from "@/lib/api";
import { useKanbanStore } from "@/store/kanban";
import type { Lead } from "@/types";

const leadSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do lead"),
  whatsapp: z.string().trim().optional(),
  instagram: z.string().trim().optional(),
  city: z.string().trim().optional(),
  category: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

/** Campos mais altos no celular (alvo de toque); no desktop mantém os 36px de sempre. */
const INPUT_TOUCH = "max-sm:h-11";

// normalizeLead preenche "Sem cidade"/"Sem categoria" quando o campo está vazio — no formulário isso é vazio.
const clean = (value?: string) => (value && !/^Sem (cidade|categoria)$/.test(value) ? value : "");

function valuesFor(lead: Lead | null | undefined, defaultCity?: string): LeadFormData {
  if (!lead) return { name: "", whatsapp: "", instagram: "", city: defaultCity ?? "", category: "", notes: "" };
  return {
    name: lead.companyName,
    whatsapp: lead.phone ?? "",
    instagram: lead.instagram ?? "",
    city: clean(lead.city),
    category: clean(lead.category),
    notes: lead.notes ?? "",
  };
}

/**
 * Cadastro e edição de lead — o mesmo formulário no Kanban geral e no painel de uma campanha.
 * Com `campaignId` o lead novo já nasce dentro do painel; com `columnId`, na coluna do Kanban.
 */
export function LeadFormDialog({
  open,
  onOpenChange,
  lead,
  campaignId,
  columnId,
  defaultCity,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presente = edição; ausente = cadastro. */
  lead?: Lead | null;
  campaignId?: string | null;
  columnId?: string;
  defaultCity?: string;
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(lead);

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: valuesFor(lead, defaultCity),
  });

  useEffect(() => {
    if (open) form.reset(valuesFor(lead, defaultCity));
    // Só reinicia ao abrir (ou ao trocar de lead) — não a cada digitação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead?.id, defaultCity]);

  const mutation = useMutation({
    mutationFn: async (data: LeadFormData) => {
      if (lead) {
        const updated = await updateLead(lead.id, {
          companyName: data.name,
          phone: data.whatsapp ?? "",
          instagram: data.instagram ?? "",
          city: data.city ?? "",
          category: data.category ?? "",
          notes: data.notes ?? "",
        });
        return { lead: updated, created: false, adopted: false };
      }
      const result = await createLead({
        name: data.name,
        whatsapp: data.whatsapp || undefined,
        instagram: data.instagram || undefined,
        city: data.city || undefined,
        category: data.category || undefined,
        notes: data.notes || undefined,
        prospectingCampaignId: campaignId,
        columnId,
        status: columnId ? getStatusForColumn(columnId) : undefined,
      });
      return { ...result, created: true };
    },
    onSuccess: ({ lead: saved, created, adopted }) => {
      const store = useKanbanStore.getState();
      if (!created) store.updateLead(saved.id, saved);
      else if (!adopted) store.addLead(saved);

      toast.success(
        isEdit ? "Lead atualizado" : adopted ? "Esse lead já existia e foi adicionado à campanha" : "Lead cadastrado",
      );
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-leads"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Não foi possível salvar o lead", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    },
  });

  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent mobileSheet className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar lead" : "Novo lead"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados de contato. O WhatsApp é salvo no formato internacional."
              : campaignId
                ? "O lead entra direto no painel desta campanha."
                : "O lead entra no Kanban geral, em “A Prospectar”."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4 pt-1">
          <Field label="Nome do estabelecimento *" error={errors.name?.message}>
            <Input autoFocus className={INPUT_TOUCH} placeholder="Ex.: Lanchonete do Zé" {...form.register("name")} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="WhatsApp" error={errors.whatsapp?.message}>
              <Input inputMode="tel" className={INPUT_TOUCH} placeholder="(21) 99999-0000" {...form.register("whatsapp")} />
            </Field>
            <Field label="Instagram" error={errors.instagram?.message}>
              <Input className={INPUT_TOUCH} autoCapitalize="none" autoCorrect="off" placeholder="@perfil ou link" {...form.register("instagram")} />
            </Field>
            <Field label="Cidade / região" error={errors.city?.message}>
              <Input className={INPUT_TOUCH} placeholder="Ex.: Ilha do Governador" {...form.register("city")} />
            </Field>
            <Field label="Categoria" error={errors.category?.message}>
              <Input className={INPUT_TOUCH} placeholder="Ex.: Hamburgueria" {...form.register("category")} />
            </Field>
          </div>

          <Field label="Observações" error={errors.notes?.message}>
            <Textarea rows={3} placeholder="Qualquer detalhe útil sobre esse lead…" {...form.register("notes")} />
          </Field>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="max-sm:h-11" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" className="max-sm:h-11" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando…" : isEdit ? "Salvar alterações" : "Cadastrar lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
