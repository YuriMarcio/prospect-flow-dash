import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLeadModalStore } from "@/store/leadModal";
import { useKanbanStore } from "@/store/kanban";
import { StatusBadge } from "./StatusBadge";
import { ActivityTimeline } from "./ActivityTimeline";
import { Building2, Instagram, Phone, MapPin, Star, Calendar, User, Link as LinkIcon, Users, ShoppingBag, ExternalLink, FileText, MessageCircle } from "lucide-react";

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
                <Row
                  icon={MessageCircle}
                  label="WhatsApp"
                  value={
                    lead.phone ? (
                      <a
                        href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {lead.phone}
                      </a>
                    ) : "—"
                  }
                />
              </TabsContent>

              <TabsContent value="instagram" className="space-y-3 pb-6">
                <Row
                  icon={Instagram}
                  label="Perfil"
                  value={
                    lead.instagram ? (
                      <a
                        href={`https://instagram.com/${lead.instagram.replace(/^@/, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        @{lead.instagram.replace(/^@/, "")}
                      </a>
                    ) : "—"
                  }
                />
                <Row
                  icon={Users}
                  label="Seguidores"
                  value={lead.followers ? lead.followers.toLocaleString("pt-BR") : "—"}
                />
                <Row icon={FileText} label="Bio" value={lead.instagramBio ?? "—"} />
                {lead.links && lead.links.length > 0 && (
                  <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                    <p className="text-xs text-muted-foreground px-3 py-2 bg-muted/40">Links encontrados</p>
                    {lead.links.map((l) => (
                      <LinkRow key={l} url={l} />
                    ))}
                  </div>
                )}
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
        <div className="text-sm font-medium mt-0.5 wrap-break-word">{value}</div>
      </div>
    </div>
  );
}

function linkMeta(url: string): { label: string; Icon: any; color: string } {
  if (/wa\.me|whatsapp/i.test(url))                                          return { label: "WhatsApp",        Icon: MessageCircle, color: "text-green-500" };
  if (/linktr\.ee/i.test(url))                                               return { label: "Linktree",         Icon: LinkIcon,      color: "text-emerald-500" };
  if (/beacons\.ai|linklist\.bio|bio\.link|lnk\.bio|later\.com\/bio/i.test(url)) return { label: "Link na Bio",    Icon: LinkIcon,      color: "text-violet-400" };
  if (/ifood\.com\.br/i.test(url))                                           return { label: "iFood",            Icon: ShoppingBag,   color: "text-red-500" };
  if (/rappi\.com\.br/i.test(url))                                           return { label: "Rappi",            Icon: ShoppingBag,   color: "text-orange-400" };
  if (/ubereats\.com/i.test(url))                                            return { label: "Uber Eats",        Icon: ShoppingBag,   color: "text-green-600" };
  if (/goomer\.app|olaclick\.com|menudino\.com|hubt\.com\.br/i.test(url))   return { label: "Cardápio Digital", Icon: ShoppingBag,   color: "text-blue-500" };
  // Para links desconhecidos, mostra o hostname como label
  try { return { label: new URL(url).hostname.replace(/^www\./, ""), Icon: ExternalLink, color: "text-muted-foreground" }; } catch {}
  return                                                                             { label: "Link externo",     Icon: ExternalLink,  color: "text-muted-foreground" };
}

function LinkRow({ url }: { url: string }) {
  const { label, Icon, color } = linkMeta(url);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors group"
    >
      <Icon className={`h-4 w-4 shrink-0 ${color}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm text-primary truncate group-hover:underline">{url}</p>
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </a>
  );
}
