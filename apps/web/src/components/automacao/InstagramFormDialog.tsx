import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ExternalLink, Rocket, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createCampaign } from "@/lib/api";
import { Field } from "./Field";

const CATEGORIES = [
  // Alimentação
  "Hamburgueria",
  "Pizzaria",
  "Sushi / Japonês",
  "Churrascaria",
  "Restaurante Árabe",
  "Restaurante Italiano",
  "Restaurante Chinês",
  "Comida Brasileira",
  "Vegano / Vegetariano",
  "Açaí",
  "Sorveteria",
  "Confeitaria / Bolos",
  "Cafeteria",
  "Padaria",
  "Lanchonete",
  "Hot Dog",
  "Pastelaria",
  "Tapiocaria",
  "Marmitaria",
  "Frango Frito",
  "Temakeria",
  "Bar / Boteco",
  // Beleza & Estética
  "Barbearia",
  "Salão de Beleza",
  "Estética / Spa",
  "Manicure / Pedicure",
  "Designer de Sobrancelhas",
  // Pet
  "Pet Shop",
  "Banho e Tosa",
  "Veterinário",
  // Saúde & Bem-estar
  "Academia",
  "Pilates",
  "Fisioterapia",
  "Nutricionista",
  "Psicólogo",
  "Clínica Odontológica",
  "Clínica Médica",
  // Outros serviços
  "Farmácia",
  "Oficina Mecânica",
  "Lavanderia",
  "Escola de Inglês",
  "Escola de Informática",
  "Arquiteto / Design de Interiores",
  "Advocacia",
  "Contabilidade",
];

function buildQueries(category: string, city: string, neighborhood?: string) {
  const location = [neighborhood, city].filter(Boolean).join(" ");
  if (!category || !city) return [];
  return [
    `site:instagram.com "${category}" "${location}"`,
    `site:instagram.com "${category} delivery" "${location}"`,
    `site:instagram.com "${category}" "${location}" "whatsapp"`,
  ];
}

function SearchPreview({
  category,
  city,
  neighborhood,
}: {
  category: string;
  city: string;
  neighborhood?: string;
}) {
  const queries = buildQueries(category, city, neighborhood);
  if (queries.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Search className="h-3.5 w-3.5" />
        Preview das buscas no Google
      </div>
      <div className="space-y-1.5">
        {queries.map((q, i) => {
          const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
          return (
            <div key={i} className="flex items-center gap-2 group">
              <span className="text-[10px] font-medium w-4 text-muted-foreground/60">{i + 1}.</span>
              <code className="flex-1 text-[11px] bg-background border border-border rounded-md px-2 py-1.5 font-mono text-foreground truncate">
                {q}
              </code>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Testar no Google"
              >
                <ExternalLink className="h-3.5 w-3.5 text-primary" />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const instagramSchema = z.object({
  category: z.string().min(1, "Informe a categoria"),
  city: z.string().min(1, "Cidade obrigatória"),
  neighborhood: z.string().optional(),
  quantity: z.coerce.number().min(1).max(2000),
});

type InstagramFormData = z.infer<typeof instagramSchema>;

export function InstagramFormDialog({
  open,
  onOpenChange,
  anyRunning,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anyRunning: boolean;
}) {
  const queryClient = useQueryClient();

  const form = useForm<InstagramFormData>({
    resolver: zodResolver(instagramSchema),
    defaultValues: { category: "", city: "", neighborhood: "", quantity: 100 },
  });

  const [category, city, neighborhood] = useWatch({
    control: form.control,
    name: ["category", "city", "neighborhood"],
  });

  const mutation = useMutation({
    mutationFn: (data: InstagramFormData) => createCampaign(data),
    onSuccess: (campaign) => {
      toast.success("Captura iniciada!", {
        description: `${campaign.category} em ${campaign.city} • ${campaign.quantity} leads`,
      });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      form.reset({ category: "", city: "", neighborhood: "", quantity: 100 });
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
          <DialogTitle>Descoberta via Instagram</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Segmento / Categoria *" error={form.formState.errors.category?.message}>
              <Input
                list="category-list"
                placeholder="Ex: Hamburgueria, Pet Shop, Barbearia…"
                {...form.register("category")}
                autoComplete="off"
              />
              <datalist id="category-list">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>

            <Field label="Cidade *" error={form.formState.errors.city?.message}>
              <Input placeholder="Ex: Curitiba" {...form.register("city")} />
            </Field>

            <Field label="Bairro (opcional)">
              <Input placeholder="Ex: Batel, Bacacheri…" {...form.register("neighborhood")} />
            </Field>

            <Field label="Quantidade de leads *" error={form.formState.errors.quantity?.message}>
              <Input type="number" min={1} max={2000} {...form.register("quantity")} />
            </Field>
          </div>

          <SearchPreview category={category} city={city} neighborhood={neighborhood} />

          {mutation.isError && (
            <p className="text-sm text-destructive">Erro ao iniciar captura. Tente novamente.</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending || anyRunning} className="glow-primary">
              <Rocket className="h-4 w-4" />
              {mutation.isPending ? "Iniciando…" : anyRunning ? "Aguarde a captura atual…" : "Iniciar Captura"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
