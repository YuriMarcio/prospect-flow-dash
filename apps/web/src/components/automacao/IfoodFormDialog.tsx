import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createIfoodCampaign } from "@/lib/api";
import { Field } from "./Field";

const ifoodSchema = z.object({
  category: z.string().min(1, "Informe a categoria"),
  city: z.string().min(1, "Cidade obrigatória"),
  zipCode: z.string().min(8, "CEP obrigatório (8 dígitos)"),
  quantity: z.coerce.number().min(1).max(500),
});

type IfoodFormData = z.infer<typeof ifoodSchema>;

export function IfoodFormDialog({
  open,
  onOpenChange,
  anyRunning,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anyRunning: boolean;
}) {
  const queryClient = useQueryClient();

  const form = useForm<IfoodFormData>({
    resolver: zodResolver(ifoodSchema),
    defaultValues: { category: "", city: "", zipCode: "", quantity: 50 },
  });

  const mutation = useMutation({
    mutationFn: (data: IfoodFormData) => createIfoodCampaign(data),
    onSuccess: (campaign) => {
      toast.success("Captura iFood iniciada!", {
        description: `${campaign.category} em ${campaign.city} • ${campaign.quantity} leads`,
      });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      form.reset({ category: "", city: "", zipCode: "", quantity: 50 });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Não foi possível iniciar a captura", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Captura via iFood</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Segmento / Categoria *" error={form.formState.errors.category?.message}>
              <Input
                list="category-list"
                placeholder="Ex: Hamburgueria, Pizzaria…"
                {...form.register("category")}
                autoComplete="off"
              />
            </Field>

            <Field label="Cidade *" error={form.formState.errors.city?.message}>
              <Input placeholder="Ex: São Luís" {...form.register("city")} />
            </Field>

            <Field label="CEP *" error={form.formState.errors.zipCode?.message}>
              <Input placeholder="Ex: 65000-000" {...form.register("zipCode")} />
            </Field>

            <Field label="Quantidade de leads *" error={form.formState.errors.quantity?.message}>
              <Input type="number" min={1} max={500} {...form.register("quantity")} />
            </Field>
          </div>

          {mutation.isError && (
            <p className="text-sm text-destructive">Erro ao iniciar captura. Tente novamente.</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending || anyRunning} className="glow-primary">
              <Rocket className="h-4 w-4" />
              {mutation.isPending ? "Iniciando…" : anyRunning ? "Aguarde a captura atual…" : "Iniciar Captura iFood"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
