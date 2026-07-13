import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { confirmTotpEnroll, startTotpEnroll } from "@/lib/vaultApi";

export function EnrollDialog({
  open,
  onOpenChange,
  onEnrolled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEnrolled: () => void;
}) {
  const [code, setCode] = useState("");

  const startQuery = useQuery({
    queryKey: ["vault-totp-enroll-start", open],
    queryFn: startTotpEnroll,
    enabled: open,
    staleTime: Infinity,
  });

  const confirmMutation = useMutation({
    mutationFn: (c: string) => confirmTotpEnroll(c),
    onSuccess: () => {
      toast.success("Autenticador cadastrado com sucesso!");
      setCode("");
      onOpenChange(false);
      onEnrolled();
    },
    onError: (err) => {
      setCode("");
      toast.error("Código inválido", { description: err instanceof Error ? err.message : undefined });
    },
  });

  function copyKey() {
    if (!startQuery.data?.manualKey) return;
    navigator.clipboard.writeText(startQuery.data.manualKey);
    toast.success("Chave copiada");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar método de autenticação</DialogTitle>
          <DialogDescription>Escaneie o QR code com seu aplicativo autenticador.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="totp">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="totp">Authenticator</TabsTrigger>
            <TabsTrigger value="sms" disabled>
              SMS
            </TabsTrigger>
            <TabsTrigger value="email" disabled>
              Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="totp" className="space-y-4 pt-2">
            {startQuery.isLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {startQuery.data && (
              <>
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <QRCodeSVG value={startQuery.data.otpauthUrl} size={180} />
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Ou digite a chave manualmente:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted rounded-md px-2 py-1.5 font-mono truncate">
                      {startQuery.data.manualKey}
                    </code>
                    <Button type="button" variant="outline" size="icon" onClick={copyKey}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border">
                  <p className="text-xs font-medium">Confirme com o código gerado pelo app:</p>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={code}
                      onChange={setCode}
                      onComplete={(v) => confirmMutation.mutate(v)}
                      pattern={REGEXP_ONLY_DIGITS}
                      inputMode="numeric"
                      disabled={confirmMutation.isPending}
                    >
                      <InputOTPGroup>
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <InputOTPSlot key={i} index={i} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <Button
                    className="w-full"
                    disabled={code.length < 6 || confirmMutation.isPending}
                    onClick={() => confirmMutation.mutate(code)}
                  >
                    {confirmMutation.isPending ? "Confirmando…" : "Confirmar"}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="sms" className="pt-2">
            <p className="text-sm text-muted-foreground text-center py-8">Em breve.</p>
          </TabsContent>
          <TabsContent value="email" className="pt-2">
            <p className="text-sm text-muted-foreground text-center py-8">Em breve.</p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
