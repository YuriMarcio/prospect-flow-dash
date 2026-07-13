import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTotpStatus, verifyTotp } from "@/lib/vaultApi";
import { useVaultAuthStore } from "@/store/vaultAuth";
import { MethodSelectStep } from "./MethodSelectStep";
import { CodeEntryStep } from "./CodeEntryStep";
import { EnrollDialog } from "./EnrollDialog";

type Step = "method" | "code";

export function VaultUnlockOverlay() {
  const queryClient = useQueryClient();
  const setUnlocked = useVaultAuthStore((s) => s.setUnlocked);
  const [step, setStep] = useState<Step>("method");
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["vault-totp-status"],
    queryFn: getTotpStatus,
  });

  const verifyMutation = useMutation({
    mutationFn: (code: string) => verifyTotp(code),
    onSuccess: (data) => {
      setVerifyError(null);
      setUnlocked(data.vaultToken, data.expiresAt);
    },
    onError: (err) => {
      setVerifyError(err instanceof Error ? err.message : "Código incorreto.");
    },
  });

  const enrolled = statusQuery.data?.enrolled ?? false;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 backdrop-blur-md bg-black/65" />

      <EnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        onEnrolled={() => {
          queryClient.invalidateQueries({ queryKey: ["vault-totp-status"] });
          setStep("code");
        }}
      />

      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl animate-fade-in">
        <div className="flex flex-col items-center text-center gap-2 mb-5">
          <div className="h-12 w-12 rounded-full bg-primary/15 text-primary grid place-items-center">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold">Verificação de identidade</h2>
          <p className="text-xs text-muted-foreground">Para acessar seu Cofre de Senhas confirme sua identidade.</p>
        </div>

        {statusQuery.isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!statusQuery.isLoading && !enrolled && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Você ainda não tem um autenticador cadastrado. Cadastre um para acessar o cofre.
            </p>
            <Button className="w-full" size="lg" onClick={() => setEnrollOpen(true)}>
              Cadastrar autenticador
            </Button>
          </div>
        )}

        {!statusQuery.isLoading && enrolled && step === "method" && (
          <MethodSelectStep onContinue={() => setStep("code")} />
        )}

        {!statusQuery.isLoading && enrolled && step === "code" && (
          <CodeEntryStep
            submitting={verifyMutation.isPending}
            error={verifyError}
            onSubmit={(code) => verifyMutation.mutate(code)}
            onBack={() => {
              setStep("method");
              setVerifyError(null);
            }}
            onEnrollClick={() => setEnrollOpen(true)}
          />
        )}
      </div>
    </div>
  );
}
