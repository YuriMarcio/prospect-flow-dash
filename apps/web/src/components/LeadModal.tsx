import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLeadModalStore } from "@/store/leadModal";
import { useKanbanStore } from "@/store/kanban";
import { StatusBadge } from "./StatusBadge";
import { ActivityTimeline } from "./ActivityTimeline";
import { Building2, Instagram, Phone, MapPin, Star, Calendar, User, Link as LinkIcon } from "lucide-react";

export function LeadModal() {
  const { leadId, close } = useLeadModalStore();
  const lead = useKanbanStore((s) => s.leads.find((l) => l.id === leadId));

  return (
    <Sheet open={!!lead} onOpenChange={(v) => !v && close()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        {lead && (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SheetTitle className="text-xl">{lead.companyName}</SheetTitle>
                  <SheetDescription className="flex items-center gap-2 mt-1">
                    {lead.category} • {lead.city}
                  </SheetDescription>
                </div>
                <StatusBadge status={lead.status} />
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="sm"><Phone className="h-3.5 w-3.5" /> Ligar</Button>
                <Button size="sm" variant="secondary">Adicionar nota</Button>
                <Button size="sm" variant="outline">Próximo follow-up</Button>
              </div>
            </SheetHeader>
            <Tabs defaultValue="empresa" className="px-6 pt-4">
              <TabsList className="w-full">
                <TabsTrigger value="empresa" className="flex-1">Empresa</TabsTrigger>
                <TabsTrigger value="instagram" className="flex-1">Instagram</TabsTrigger>
                <TabsTrigger value="comercial" className="flex-1">Comercial</TabsTrigger>
                <TabsTrigger value="timeline" className="flex-1">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="empresa" className="space-y-3 pb-6">
                <Row icon={Building2} label="Nome" value={lead.companyName} />
                <Row icon={LinkIcon} label="CNPJ" value={lead.cnpj ?? "—"} />
                <Row icon={Star} label="Categoria" value={lead.category} />
                <Row icon={MapPin} label="Endereço" value={lead.address ?? "—"} />
                <Row icon={Phone} label="Telefone" value={lead.phone} />
              </TabsContent>

              <TabsContent value="instagram" className="space-y-3 pb-6">
                <Row icon={Instagram} label="Username" value={lead.instagram ?? "—"} />
                <Row icon={User} label="Bio" value={lead.instagramBio ?? "—"} />
                <Row icon={User} label="Seguidores" value={lead.followers?.toLocaleString("pt-BR") ?? "—"} />
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-2">Links encontrados</p>
                  <div className="space-y-1">
                    {lead.links?.map((l) => (
                      <a key={l} href={l} className="block text-sm text-primary hover:underline truncate">{l}</a>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="comercial" className="space-y-3 pb-6">
                <Row icon={Star} label="Score" value={<span className="font-semibold">{lead.score}/100</span>} />
                <Row icon={User} label="Responsável" value={lead.owner} />
                <Row icon={Building2} label="Pipeline atual" value={<StatusBadge status={lead.status} />} />
                <Row icon={Calendar} label="Próximo follow-up" value={lead.nextFollowUp ?? "—"} />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {lead.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                </div>
              </TabsContent>

              <TabsContent value="timeline" className="pb-6">
                <ActivityTimeline events={lead.timeline} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
      <div className="h-8 w-8 rounded-md bg-muted grid place-items-center text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium mt-0.5 break-words">{value}</div>
      </div>
    </div>
  );
}
