import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { connectWhatsapp, getInstanceStatus } from "@/lib/prospector";

export function ConnectQrDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [instanceName, setInstanceName] = useState("leadflow-whatsapp");
  const [numberAge, setNumberAge] = useState<"new" | "established">("established");
  const [qrcode, setQrcode] = useState<string | null>(null);

  const connectMutation = useMutation({
    mutationFn: connectWhatsapp,
    onSuccess: (result) => setQrcode(result.qrcode),
  });

  const statusQuery = useQuery({
    queryKey: ["instance-status-connecting"],
    queryFn: getInstanceStatus,
    enabled: open && Boolean(qrcode),
    refetchInterval: open && Boolean(qrcode) ? 3000 : false,
  });

  useEffect(() => {
    if (statusQuery.data?.connected) {
      queryClient.invalidateQueries({ queryKey: ["instance-status"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-status"] });
      onOpenChange(false);
    }
  }, [statusQuery.data?.connected]);

  useEffect(() => {
    if (!open) {
      setQrcode(null);
      connectMutation.reset();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" />
            Conectar WhatsApp
          </DialogTitle>
        </DialogHeader>

        {!qrcode ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome da instância</Label>
              <Input value={instanceName} onChange={(e) => setInstanceName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Esse número já tem histórico de uso?</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={numberAge === "established" ? "default" : "outline"}
                  onClick={() => setNumberAge("established")}
                  className="flex-1"
                >
                  Já estabelecido
                </Button>
                <Button
                  type="button"
                  variant={numberAge === "new" ? "default" : "outline"}
                  onClick={() => setNumberAge("new")}
                  className="flex-1"
                >
                  Número novo
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {numberAge === "established"
                  ? "Pula o aquecimento e usa o limite diário configurado direto."
                  : "Ativa o aquecimento gradual (5/dia → 15/dia → 25/dia nos primeiros 14 dias)."}
              </p>
            </div>
            {connectMutation.isError && (
              <p className="text-sm text-destructive">
                Não foi possível gerar o QR. Tente novamente.
              </p>
            )}
            <DialogFooter>
              <Button
                onClick={() => connectMutation.mutate({ instanceName, numberAge })}
                disabled={connectMutation.isPending || !instanceName.trim()}
              >
                {connectMutation.isPending ? "Gerando QR…" : "Gerar QR Code"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <div className="flex justify-center rounded-lg border border-border bg-white p-4">
              {qrcode.startsWith("data:") ? (
                <img src={qrcode} alt="QR Code de conexão" className="h-56 w-56" />
              ) : (
                <QRCodeSVG value={qrcode} size={224} />
              )}
            </div>
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Escaneie com o WhatsApp e aguarde a conexão…
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
