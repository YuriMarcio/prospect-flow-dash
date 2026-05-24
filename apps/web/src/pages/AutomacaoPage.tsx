import { Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Bot, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  category: z.string().min(1, "Selecione uma categoria"),
  city: z.string().min(1, "Cidade obrigatória"),
  neighborhood: z.string().optional(),
  quantity: z.coerce.number().min(1).max(2000),
  delay: z.coerce.number().min(1).max(60),
  limit: z.coerce.number().min(1).max(5000),
});

type FormData = z.infer<typeof schema>;

export function AutomacaoPage() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: "Hamburgueria", city: "", quantity: 100, delay: 3, limit: 500 },
  });

  const onSubmit = (data: FormData) => {
    toast.success("Captura iniciada!", { description: `${data.category} em ${data.city} • ${data.quantity} leads` });
    form.reset();
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary grid place-items-center">
          <Bot className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nova Captura</h1>
          <p className="text-sm text-muted-foreground">Configure os parâmetros para iniciar uma automação iFood.</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Categoria iFood" error={form.formState.errors.category?.message}>
            <Select onValueChange={(v) => form.setValue("category", v)} defaultValue={form.getValues("category")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Hamburgueria", "Pizzaria", "Restaurante Japonês", "Açaí", "Cafeteria", "Padaria"].map((c) =>
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cidade" error={form.formState.errors.city?.message}>
            <Input placeholder="Ex. São Paulo" {...form.register("city")} />
          </Field>
          <Field label="Bairro (opcional)">
            <Input placeholder="Ex. Vila Mariana" {...form.register("neighborhood")} />
          </Field>
          <Field label="Quantidade de leads" error={form.formState.errors.quantity?.message}>
            <Input type="number" {...form.register("quantity")} />
          </Field>
          <Field label="Delay entre capturas (s)" error={form.formState.errors.delay?.message}>
            <Input type="number" {...form.register("delay")} />
          </Field>
          <Field label="Limite de execução" error={form.formState.errors.limit?.message}>
            <Input type="number" {...form.register("limit")} />
          </Field>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Link to="/capturas" className="text-sm text-muted-foreground hover:text-foreground">
            Ver execuções →
          </Link>
          <Button type="submit" size="lg" className="glow-primary">
            <Rocket className="h-4 w-4" /> Iniciar Captura
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
