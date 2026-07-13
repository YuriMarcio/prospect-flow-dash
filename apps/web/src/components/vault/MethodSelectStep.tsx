import { useState } from "react";
import { Mail, MessageSquare, Smartphone } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Method = "totp" | "sms" | "email";

export function MethodSelectStep({ onContinue }: { onContinue: () => void }) {
  const [method, setMethod] = useState<Method>("totp");

  return (
    <div className="space-y-5">
      <RadioGroup value={method} onValueChange={(v) => setMethod(v as Method)} className="space-y-2">
        <label
          className={cn(
            "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
            method === "totp" ? "border-primary bg-primary/5" : "border-border",
          )}
        >
          <RadioGroupItem value="totp" />
          <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium flex-1">Aplicativo Authenticator</span>
        </label>

        <label className="flex items-center gap-3 rounded-lg border border-border p-3 opacity-50 cursor-not-allowed">
          <RadioGroupItem value="sms" disabled />
          <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium flex-1">SMS</span>
          <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded-full shrink-0">Em breve</span>
        </label>

        <label className="flex items-center gap-3 rounded-lg border border-border p-3 opacity-50 cursor-not-allowed">
          <RadioGroupItem value="email" disabled />
          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium flex-1">Email</span>
          <span className="text-[10px] font-medium bg-muted px-2 py-0.5 rounded-full shrink-0">Em breve</span>
        </label>
      </RadioGroup>

      <Button className="w-full" size="lg" onClick={onContinue}>
        Continuar
      </Button>
    </div>
  );
}
