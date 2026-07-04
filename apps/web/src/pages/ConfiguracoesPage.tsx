import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useThemeStore } from "@/store/theme";
import { useAuthStore } from "@/store/auth";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getMe, updateProfile } from "@/lib/api";

export function ConfiguracoesPage() {
  const { theme, toggle } = useThemeStore();
  const queryClient = useQueryClient();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const meQuery = useQuery({ queryKey: ["me"], queryFn: getMe });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (meQuery.data) {
      setName(meQuery.data.name ?? "");
      setPhone(meQuery.data.phone ?? "");
    }
  }, [meQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => updateProfile({ name, phone: phone || null }),
    onSuccess: (user) => {
      queryClient.setQueryData(["me"], user);
      setAuthenticated(user);
      toast.success("Dados atualizados.");
    },
    onError: () => toast.error("Não foi possível salvar as alterações."),
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Personalize sua experiência.</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 space-y-5">
        <h2 className="text-sm font-semibold">Conta</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="conta-nome">Nome</Label>
            <Input
              id="conta-nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="conta-email">Email</Label>
            <Input id="conta-email" value={meQuery.data?.email ?? "—"} disabled />
            <p className="text-[11px] text-muted-foreground">
              {meQuery.data?.email
                ? "Vinculado à sua conta Google, não pode ser alterado aqui."
                : "Login por usuário/senha, sem e-mail vinculado."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="conta-telefone">Telefone</Label>
            <Input
              id="conta-telefone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </div>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || meQuery.isLoading}>
          {saveMutation.isPending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold">Aparência</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Tema escuro</p>
            <p className="text-xs text-muted-foreground">Reduz cansaço visual em sessões longas.</p>
          </div>
          <Switch checked={theme === "dark"} onCheckedChange={toggle} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold">Notificações</h2>
        {[
          "Novos leads capturados",
          "Movimentações no pipeline",
          "Capturas concluídas",
          "Resumo semanal",
        ].map((n) => (
          <div key={n} className="flex items-center justify-between">
            <p className="text-sm">{n}</p>
            <Switch defaultChecked />
          </div>
        ))}
      </section>
    </div>
  );
}
