import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Bot, ExternalLink, Rocket, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCampaign } from "@/lib/api";
import { useWatch } from "react-hook-form";

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

const schema = z.object({
  category: z.string().min(1, "Informe a categoria"),
  city: z.string().min(1, "Cidade obrigatória"),
  neighborhood: z.string().optional(),
  quantity: z.coerce.number().min(1).max(2000),
});

type FormData = z.infer<typeof schema>;

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
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Search className="h-3.5 w-3.5" />
        Preview das buscas no Google
      </div>
      <div className="space-y-2">
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
      <p className="text-[10px] text-muted-foreground">
        Passe o mouse sobre cada query e clique no ícone para testar no Google antes de rodar.
      </p>
    </div>
  );
}

export function AutomacaoPage() {
  const queryClient = useQueryClient();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: "",
      city: "",
      neighborhood: "",
      quantity: 100,
    },
  });

  const [category, city, neighborhood] = useWatch({
    control: form.control,
    name: ["category", "city", "neighborhood"],
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => createCampaign(data),
    onSuccess: (campaign) => {
      toast.success("Captura iniciada!", {
        description: `${campaign.category} em ${campaign.city} • ${campaign.quantity} leads`,
      });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      form.reset({ category: "", city: "", neighborhood: "", quantity: 100 });
    },
    onError: (error) => {
      toast.error("Não foi possível iniciar a captura", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    },
  });

  const onSubmit = (data: FormData) => mutation.mutate(data);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary grid place-items-center">
          <Bot className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nova Captura</h1>
          <p className="text-sm text-muted-foreground">
            Configure os parâmetros e rode a automação de descoberta via Instagram.
          </p>
        </div>
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="rounded-xl border border-border bg-card p-6 space-y-5"
      >
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

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Link
            to="/capturas"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver execuções →
          </Link>
          <Button type="submit" size="lg" className="glow-primary" disabled={mutation.isPending}>
            <Rocket className="h-4 w-4" />
            {mutation.isPending ? "Iniciando…" : "Iniciar Captura"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
