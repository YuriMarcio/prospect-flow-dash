import { useThemeStore } from "@/store/theme";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ConfiguracoesPage() {
  const { theme, toggle } = useThemeStore();
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Personalize sua experiência.</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 space-y-5">
        <h2 className="text-sm font-semibold">Conta</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Nome</Label><Input defaultValue="Ana Silva" /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input defaultValue="ana@prospect.ai" /></div>
          <div className="space-y-1.5"><Label>Empresa</Label><Input defaultValue="ProspectAI" /></div>
          <div className="space-y-1.5"><Label>Telefone</Label><Input defaultValue="(11) 99999-9999" /></div>
        </div>
        <Button>Salvar alterações</Button>
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
        {["Novos leads capturados", "Movimentações no pipeline", "Capturas concluídas", "Resumo semanal"].map((n) => (
          <div key={n} className="flex items-center justify-between">
            <p className="text-sm">{n}</p>
            <Switch defaultChecked />
          </div>
        ))}
      </section>
    </div>
  );
}
