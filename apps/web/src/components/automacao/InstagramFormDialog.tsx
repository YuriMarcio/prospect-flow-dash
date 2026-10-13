import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ExternalLink, Rocket, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createCampaign, type DiscoverySource } from "@/lib/api";
import { Field } from "./Field";
import { SegmentPicker } from "./SegmentPicker";
import { CaptureDestinationField } from "./CaptureDestinationField";
import { NO_DESTINATION, resolveDestination } from "./captureDestination";

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

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const SOURCE_OPTIONS: Array<{ id: DiscoverySource; label: string; hint: string }> = [
  { id: "maps", label: "Google Meu Negócio", hint: "Estabelecimentos reais, com endereço e telefone" },
  { id: "instagram", label: "Instagram", hint: "Perfis do nicho e WhatsApp da bio" },
];

/** "Sushi / Japonês" → ["Sushi", "Japonês"] (mesma regra do backend). */
function categoryAlternatives(category: string) {
  const parts = category.split(/[/,]/).map((part) => part.replace(/"/g, "").trim()).filter(Boolean);
  return parts.length > 0 ? parts : [category.trim()];
}

/** Só a primeira busca de cada fonte: o backend gera mais variações (sinônimos, delivery, UF). */
function buildQueries(category: string, city: string, neighborhood: string | undefined, state: string, sources: DiscoverySource[]) {
  if (!category || !city) return [];

  const alternatives = categoryAlternatives(category);
  const phrases = alternatives.map((alt) => `"${alt}"`);
  const location = [neighborhood, city].filter(Boolean).join(" ");
  const queries: Array<{ label: string; query: string; url: string }> = [];

  if (sources.includes("maps")) {
    const query = `${alternatives[0]} em ${location}${state ? `, ${state}` : ""}`;
    queries.push({
      label: "Google Meu Negócio",
      query,
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    });
  }

  if (sources.includes("instagram")) {
    const term = phrases.length > 1 ? `(${phrases.join(" OR ")})` : phrases[0];
    const query = `site:instagram.com ${term} "${location}"`;
    queries.push({
      label: "Instagram",
      query,
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    });
  }

  return queries;
}

function SearchPreview({
  category,
  segments,
  city,
  neighborhood,
  state,
  sources,
}: {
  category: string;
  segments: number;
  city: string;
  neighborhood?: string;
  state: string;
  sources: DiscoverySource[];
}) {
  const queries = buildQueries(category, city, neighborhood, state, sources);
  if (queries.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Search className="h-3.5 w-3.5" />
        Exemplo das buscas{segments > 1 ? ` (1º de ${segments} segmentos)` : ""}
      </div>
      <div className="space-y-1.5">
        {queries.map(({ label, query, url }) => (
          <div key={label} className="flex items-center gap-2 group">
            <span className="text-[10px] font-medium w-24 shrink-0 text-muted-foreground/70">{label}</span>
            <code className="flex-1 text-[11px] bg-background border border-border rounded-md px-2 py-1.5 font-mono text-foreground truncate">
              {query}
            </code>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Testar"
            >
              <ExternalLink className="h-3.5 w-3.5 text-primary" />
            </a>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        O sistema roda variações (sinônimos, delivery, UF) em cada segmento e só aprofunda as buscas que estão rendendo.
      </p>
    </div>
  );
}

/** Teto de segmentos por captura (o backend valida o mesmo limite). */
const MAX_SEGMENTS = 5;

const instagramSchema = z.object({
  categories: z.array(z.string().min(1)).min(1, "Escolha ao menos um segmento").max(MAX_SEGMENTS),
  city: z.string().min(1, "Cidade obrigatória"),
  state: z.string().length(2, "Selecione a UF"),
  neighborhood: z.string().optional(),
  quantity: z.coerce.number().min(1).max(2000),
  sources: z.array(z.enum(["maps", "instagram"])).min(1, "Escolha ao menos uma fonte"),
});

type InstagramFormData = z.infer<typeof instagramSchema>;

export function InstagramFormDialog({
  open,
  onOpenChange,
  anyRunning,
  campaignId,
  defaultCity,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anyRunning: boolean;
  /** Painel que recebe os leads (aberto de dentro de uma campanha); sem ele o usuário escolhe. */
  campaignId?: string | null;
  /** Cidade já preenchida — o território da campanha, quando aberto de dentro dela. */
  defaultCity?: string;
}) {
  const queryClient = useQueryClient();
  const [destination, setDestination] = useState(NO_DESTINATION);

  const form = useForm<InstagramFormData>({
    resolver: zodResolver(instagramSchema),
    defaultValues: { categories: [], city: defaultCity ?? "", state: "", neighborhood: "", quantity: 100, sources: ["maps", "instagram"] },
  });

  // Aberto de dentro de uma campanha, a cidade já vem com o território dela
  useEffect(() => {
    if (open && defaultCity) form.setValue("city", defaultCity);
  }, [open, defaultCity, form]);

  const [categories, city, neighborhood, state, sources, quantity] = useWatch({
    control: form.control,
    name: ["categories", "city", "neighborhood", "state", "sources", "quantity"],
  });

  const mutation = useMutation({
    mutationFn: (data: InstagramFormData) =>
      createCampaign({
        ...data,
        category: data.categories[0],
        prospectingCampaignId: resolveDestination(campaignId, destination),
      }),
    onSuccess: (campaign) => {
      toast.success("Captura iniciada!", {
        description: `${campaign.category} em ${campaign.city} • ${campaign.quantity} leads`,
      });
      queryClient.invalidateQueries({ queryKey: ["captures"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setDestination(NO_DESTINATION);
      form.reset({ categories: [], city: defaultCity ?? "", state: "", neighborhood: "", quantity: 100, sources: ["maps", "instagram"] });
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
          <DialogTitle>Descoberta de leads</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Segmentos *" error={form.formState.errors.categories?.message}>
                <SegmentPicker
                  value={categories}
                  onChange={(segments) => form.setValue("categories", segments, { shouldValidate: true })}
                  options={CATEGORIES}
                  max={MAX_SEGMENTS}
                />
              </Field>
            </div>

            <Field label="Cidade *" error={form.formState.errors.city?.message}>
              <Input placeholder="Ex: Curitiba" {...form.register("city")} />
            </Field>

            <Field label="UF *" error={form.formState.errors.state?.message}>
              <Select value={state} onValueChange={(value) => form.setValue("state", value, { shouldValidate: true })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {UFS.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Bairro (opcional)">
              <Input placeholder="Ex: Batel, Bacacheri…" {...form.register("neighborhood")} />
            </Field>

            <Field
              label={categories.length > 1 ? "Leads por segmento *" : "Quantidade de leads *"}
              error={form.formState.errors.quantity?.message}
            >
              <Input type="number" min={1} max={2000} {...form.register("quantity")} />
              {categories.length > 1 && Number(quantity) > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Até {Number(quantity) * categories.length} leads no total ({categories.length} segmentos).
                </p>
              )}
            </Field>
          </div>

          <Field label="Fontes *" error={form.formState.errors.sources?.message}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SOURCE_OPTIONS.map((option) => {
                const checked = sources.includes(option.id);
                return (
                  <label
                    key={option.id}
                    className="flex items-start gap-2 rounded-lg border border-border p-3 cursor-pointer hover:bg-accent/40 transition"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        form.setValue(
                          "sources",
                          value === true ? [...sources, option.id] : sources.filter((source) => source !== option.id),
                          { shouldValidate: true },
                        )
                      }
                      className="mt-0.5"
                    />
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{option.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </Field>

          <SearchPreview category={categories[0] ?? ""} segments={categories.length} city={city} neighborhood={neighborhood} state={state} sources={sources} />

          <CaptureDestinationField value={destination} onChange={setDestination} fixedCampaignId={campaignId} />

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
