import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Rocket,
  Search,
  Store,
  Terminal,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  createCampaign,
  createIfoodCampaign,
  createInstaDeliveryCampaign,
  getInstaDeliveryCities,
  listCampaignLogs,
  listCampaigns,
} from "@/lib/api";
import { useWatch } from "react-hook-form";
import type { Capture } from "@/types";

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

// ─── Moldura padrão de cada fluxo de captura ────────────────────────────────

function FlowCard({
  icon: Icon,
  title,
  badge,
  bullets,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge: string;
  bullets: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {badge}
        </span>
      </div>
      <ul className="rounded-lg border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground space-y-1">
        {bullets.map((b) => (
          <li key={b}>• {b}</li>
        ))}
      </ul>
      {children}
    </div>
  );
}

function FlowFooter({ disabled, pending, label }: { disabled: boolean; pending: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between pt-2 border-t border-border">
      <Link
        to="/capturas"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Ver execuções →
      </Link>
      <Button type="submit" size="lg" disabled={disabled} className="glow-primary">
        <Rocket className="h-4 w-4" />
        {pending ? "Iniciando…" : label}
      </Button>
    </div>
  );
}

// ─── Monitor de campanha ativa ───────────────────────────────────────────────

function ActiveCampaignMonitor({ campaign }: { campaign: Capture }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isRunning = campaign.status === "running";

  const logsQuery = useQuery({
    queryKey: ["logs", campaign.id],
    queryFn: () => listCampaignLogs(campaign.id),
    refetchInterval: isRunning ? 3000 : false,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logsQuery.data?.length]);

  const logs = logsQuery.data ?? [];
  const pct = campaign.quantity > 0
    ? Math.min(100, Math.round((campaign.processed / campaign.quantity) * 100))
    : 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/40 border-b border-border">
        {isRunning ? (
          <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
        ) : campaign.status === "done" ? (
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{campaign.category} — {campaign.city}</p>
          <p className="text-[11px] text-muted-foreground">
            {campaign.found} leads salvos · {campaign.processed}/{campaign.quantity} processados
          </p>
        </div>
        {isRunning && (
          <span className="flex items-center gap-1 text-[10px] text-green-400 font-mono shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            AO VIVO
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2 border-b border-border">
        <Progress value={pct} className="h-1.5" />
      </div>

      {/* Terminal de logs */}
      <div className="bg-zinc-950">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
          <Terminal className="h-3 w-3 text-zinc-500 ml-1" />
          <span className="text-[10px] text-zinc-500 font-mono">capture.log</span>
        </div>
        <div className="font-mono text-[11px] p-3 space-y-0.5 max-h-52 overflow-y-auto text-zinc-300">
          {logs.length === 0 && (
            <p className="text-zinc-600">$ Aguardando logs…</p>
          )}
          {logs.map((log, i) => (
            <div key={i} className="flex gap-2 leading-5">
              <span className="text-zinc-600 shrink-0 tabular-nums">{log.time}</span>
              <span className={
                log.level === "error" ? "text-red-400 shrink-0"
                : log.level === "warn" ? "text-yellow-400 shrink-0"
                : "text-zinc-500 shrink-0"
              }>
                [{log.level.toUpperCase().padEnd(4)}]
              </span>
              <span className={
                log.level === "error" ? "text-red-300"
                : log.level === "warn" ? "text-yellow-300"
                : "text-zinc-300"
              }>
                {log.message}
              </span>
            </div>
          ))}
          {isRunning && (
            <div className="text-green-400 pt-0.5">
              <span className="animate-pulse">▋</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

// ─── Fluxo 1: Descoberta via Instagram ───────────────────────────────────────

const instagramSchema = z.object({
  category: z.string().min(1, "Informe a categoria"),
  city: z.string().min(1, "Cidade obrigatória"),
  neighborhood: z.string().optional(),
  quantity: z.coerce.number().min(1).max(2000),
});

type InstagramFormData = z.infer<typeof instagramSchema>;

function InstagramForm({ anyRunning }: { anyRunning: boolean }) {
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
    },
    onError: (error) => {
      toast.error("Não foi possível iniciar a captura", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    },
  });

  return (
    <FlowCard
      icon={Search}
      title="Descoberta via Instagram"
      badge="Google Dorking direto"
      bullets={[
        "Busca perfis no Instagram via Google (site:instagram.com)",
        "Extrai WhatsApp/Linktree direto do snippet da busca",
        "Mais rápido, ideal quando o público já está ativo no Instagram",
      ]}
    >
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
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

        <FlowFooter
          disabled={mutation.isPending || anyRunning}
          pending={mutation.isPending}
          label={anyRunning ? "Aguarde a captura atual…" : "Iniciar Captura"}
        />
      </form>
    </FlowCard>
  );
}

// ─── Fluxo 2: Captura via iFood ───────────────────────────────────────────────

const ifoodSchema = z.object({
  category: z.string().min(1, "Informe a categoria"),
  city: z.string().min(1, "Cidade obrigatória"),
  zipCode: z.string().min(8, "CEP obrigatório (8 dígitos)"),
  quantity: z.coerce.number().min(1).max(500),
});

type IfoodFormData = z.infer<typeof ifoodSchema>;

function IfoodForm({ anyRunning }: { anyRunning: boolean }) {
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
    },
    onError: (error) => {
      toast.error("Não foi possível iniciar a captura", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    },
  });

  return (
    <FlowCard
      icon={UtensilsCrossed}
      title="Captura via iFood"
      badge="iFood → Instagram → Enriquecimento"
      bullets={[
        "1. Busca restaurantes ativos no iFood pelo CEP (GeckoAPI)",
        "2. Acha o Instagram de cada um via Google Dorking",
        "3. Enriquece o perfil: seguidores, bio completa, links e WhatsApp",
      ]}
    >
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
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

        <FlowFooter
          disabled={mutation.isPending || anyRunning}
          pending={mutation.isPending}
          label={anyRunning ? "Aguarde a captura atual…" : "Iniciar Captura iFood"}
        />
      </form>
    </FlowCard>
  );
}

// ─── Fluxo 3: Captura via InstaDelivery ──────────────────────────────────────

const instaDeliverySchema = z.object({
  city: z.string().min(1, "Selecione uma cidade"),
  quantity: z.coerce.number().min(1).max(200),
});

type InstaDeliveryFormData = z.infer<typeof instaDeliverySchema>;

function InstaDeliveryForm({ anyRunning }: { anyRunning: boolean }) {
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
    },
    onError: (error) => {
      toast.error("Não foi possível iniciar a captura", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    },
  });

  return (
    <FlowCard
      icon={Store}
      title="Captura via InstaDelivery"
      badge="Extrai nome + WhatsApp das lojas"
      bullets={[
        "Raspa todas as lojas da cidade no portal InstaDelivery (scroll infinito)",
        "Extrai WhatsApp de cada loja e busca o Instagram via Google",
        "Leads salvos com source: instadelivery",
      ]}
    >
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
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

        <FlowFooter
          disabled={mutation.isPending || citiesQuery.isLoading || anyRunning}
          pending={mutation.isPending}
          label={anyRunning ? "Aguarde a captura atual…" : "Iniciar Captura InstaDelivery"}
        />
      </form>
    </FlowCard>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export function AutomacaoPage() {
  const campaignsQuery = useQuery({
    queryKey: ["campaigns"],
    queryFn: listCampaigns,
    refetchInterval: (q) => {
      const data = q.state.data as Capture[] | undefined;
      return data?.some((c) => c.status === "running") ? 3000 : false;
    },
  });

  const campaigns = campaignsQuery.data ?? [];
  const activeCampaign = campaigns.find((c) => c.status === "running")
    ?? (campaigns[0]?.status === "done" || campaigns[0]?.status === "error" ? campaigns[0] : undefined);
  const anyRunning = campaigns.some((c) => c.status === "running");

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Automações de Captação</h1>
        <p className="text-sm text-muted-foreground">
          Escolha um fluxo abaixo e configure os parâmetros para rodar a automação.
        </p>
      </div>

      <InstagramForm anyRunning={anyRunning} />
      <IfoodForm anyRunning={anyRunning} />
      <InstaDeliveryForm anyRunning={anyRunning} />

      {activeCampaign && <ActiveCampaignMonitor campaign={activeCampaign} />}
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
