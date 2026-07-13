import { useState } from "react";
import { Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Button } from "@/components/ui/button";

export function CodeEntryStep({
  onSubmit,
  onBack,
  onEnrollClick,
  submitting,
  error,
}: {
  onSubmit: (code: string) => void;
  onBack: () => void;
  onEnrollClick: () => void;
  submitting: boolean;
  error?: string | null;
}) {
  const [code, setCode] = useState("");

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold">Digite o código</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Abra seu aplicativo autenticador e digite o código de 6 dígitos.
        </p>
      </div>

      <div className="flex justify-center">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={setCode}
          onComplete={onSubmit}
          pattern={REGEXP_ONLY_DIGITS}
          inputMode="numeric"
          autoFocus
          disabled={submitting}
        >
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      {error && <p className="text-xs text-destructive text-center">{error}</p>}

      <Button className="w-full" size="lg" disabled={code.length < 6 || submitting} onClick={() => onSubmit(code)}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? "Verificando…" : "Verificar"}
      </Button>

      <div className="flex items-center justify-between text-xs">
        <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
          Trocar método
        </button>
        <button
          type="button"
          onClick={onEnrollClick}
          className="text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
        >
          Cadastrar novo dispositivo
        </button>
      </div>
    </div>
  );
}
