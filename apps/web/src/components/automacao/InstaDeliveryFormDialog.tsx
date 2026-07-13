import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { createInstaDeliveryCampaign, getInstaDeliveryCities } from "@/lib/api";
import { Field } from "./Field";

const instaDeliverySchema = z.object({
  city: z.string().min(1, "Selecione uma cidade"),
  quantity: z.coerce.number().min(1).max(200),
});

type InstaDeliveryFormData = z.infer<typeof instaDeliverySchema>;

export function InstaDeliveryFormDialog({
  open,
  onOpenChange,
  anyRunning,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anyRunning: boolean;
}) {
  const queryClient = useQueryClient();

  const citiesQuery = useQuery({
    queryKey: ["instadelivery-cities"],
    queryFn: getInstaDeliveryCities,
    staleTime: Infinity,
  });

  const form = useForm<InstaDeliveryFormData>({
    resolver: zodResolver(instaDeliverySchema),
    defaultValues: { city: "", quantity: 50 },
  });

  const mutation = useMutation({
    mutationFn: (data: InstaDeliveryFormData) => createInstaDeliveryCampaign(data),
    onSuccess: (campaign) => {
      toast.success("Captura InstaDelivery iniciada!", {
        description: `${campaign.city} • até ${campaign.quantity} lojas`,
      });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      form.reset({ city: "", quantity: 50 });
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
          <DialogTitle>Captura via InstaDelivery</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Cidade *" error={form.formState.errors.city?.message}>
              <Input
                list="id-city-list"
                placeholder="Digite ou selecione uma cidade…"
                {...form.register("city")}
                autoComplete="off"
              />
              <datalist id="id-city-list">
                {(citiesQuery.data ?? []).map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>

            <Field label="Máx. de lojas *" error={form.formState.errors.quantity?.message}>
              <Input type="number" min={1} max={200} {...form.register("quantity")} />
            </Field>
          </div>

          {mutation.isError && (
            <p className="text-sm text-destructive">Erro ao iniciar captura. Tente novamente.</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || citiesQuery.isLoading || anyRunning}
              className="glow-primary"
            >
              <Rocket className="h-4 w-4" />
              {mutation.isPending
                ? "Iniciando…"
                : anyRunning
                  ? "Aguarde a captura atual…"
                  : "Iniciar Captura InstaDelivery"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
