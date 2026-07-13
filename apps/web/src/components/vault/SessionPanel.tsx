import { useEffect, useState } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVaultAuthStore } from "@/store/vaultAuth";
import { lockVault } from "@/lib/vaultApi";

const SESSION_TOTAL_MS = 30 * 60 * 1000;

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SessionPanel() {
  const unlockedUntil = useVaultAuthStore((s) => s.unlockedUntil);
  const lock = useVaultAuthStore((s) => s.lock);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (unlockedUntil && now >= unlockedUntil) lock();
  }, [now, unlockedUntil, lock]);

  const remainingMs = unlockedUntil ? unlockedUntil - now : 0;
  const pct = unlockedUntil ? Math.max(0, Math.min(100, (remainingMs / SESSION_TOTAL_MS) * 100)) : 0;

  function handleEndSession() {
    lock();
    lockVault().catch(() => {});
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-success/15 text-success grid place-items-center">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <p className="text-sm font-semibold">Sessão segura</p>
      </div>

      <div>
        <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatRemaining(remainingMs)}</p>
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-success transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">Sua sessão expira em 30 minutos por segurança.</p>
      </div>

      <Button
        variant="outline"
        className="w-full text-destructive border-destructive/40 hover:bg-destructive/10"
        onClick={handleEndSession}
      >
        <LogOut className="h-4 w-4" />
        Encerrar sessão
      </Button>
    </div>
  );
}
