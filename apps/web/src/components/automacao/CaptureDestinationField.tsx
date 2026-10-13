import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listCampaigns } from "@/lib/prospector";
import { Field } from "./Field";
import { NO_DESTINATION } from "./captureDestination";

/**
 * Para onde vão os leads capturados: o Kanban geral ou o painel de uma campanha.
 * Aberta de dentro do painel (`fixedCampaignId`), o destino já está decidido e só é mostrado.
 */
export function CaptureDestinationField({
  value,
  onChange,
  fixedCampaignId,
}: {
  value: string;
  onChange: (value: string) => void;
  fixedCampaignId?: string | null;
}) {
  const campaignsQuery = useQuery({ queryKey: ["prospecting-campaigns"], queryFn: listCampaigns });
  const campaigns = campaignsQuery.data ?? [];

  if (fixedCampaignId) {
    const name = campaigns.find((campaign) => campaign.id === fixedCampaignId)?.name ?? "da campanha";
    return (
      <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Os leads capturados vão direto para o painel <span className="font-medium text-foreground">{name}</span>.
      </p>
    );
  }

  return (
    <Field label="Enviar os leads para">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_DESTINATION}>Kanban geral (sem campanha)</SelectItem>
          {campaigns.map((campaign) => (
            <SelectItem key={campaign.id} value={campaign.id}>
              {campaign.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
