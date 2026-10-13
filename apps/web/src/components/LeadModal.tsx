import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLeadModalStore } from "@/store/leadModal";
import { useKanbanStore } from "@/store/kanban";
import { LeadFormDialog } from "@/components/prospector/campaign-panel/LeadFormDialog";
import { StatusBadge } from "./StatusBadge";
import { ActivityTimeline } from "./ActivityTimeline";
import { Building2, Instagram, Pencil, Phone, MapPin, Star, Calendar, User, Link as LinkIcon, Users, ShoppingBag, ExternalLink, FileText, MessageCircle } from "lucide-react";

export function LeadModal() {
  const { leadId, close } = useLeadModalStore();
  const lead = useKanbanStore((s) => s.leads.find((l) => l.id === leadId));
  const [editing, setEditing] = useState(false);

  return (
    <>
    <Sheet open={!!lead} onOpenChange={(v) => !v && close()}>
      {/* No celular ocupa a tela toda (dvh + áreas seguras do iPhone); a partir de sm vira o painel lateral */}
      <SheetContent
        className="h-dvh w-full overflow-y-auto overscroll-contain p-0 pb-[env(safe-area-inset-bottom)] sm:max-w-xl"
        // No toque o foco automático cairia no botão de fechar e deixaria um anel no X; no desktop segue o padrão
        onOpenAutoFocus={(e) => {
          if (window.matchMedia("(pointer: coarse)").matches) e.preventDefault();
        }}
      >
        {lead && (
          <>
            <SheetHeader className="border-b border-border px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] text-left sm:px-6 sm:pt-6">
              {/* pr-8 deixa o espaço do botão de fechar (fixo no canto) */}
              <div className="flex items-start justify-between gap-3 pr-8">
                <div className="min-w-0">
                  <SheetTitle className="break-words text-lg sm:text-xl">{lead.companyName}</SheetTitle>
                  <SheetDescription className="mt-1 flex items-center gap-2">
                    {lead.category} • {lead.city}
                  </SheetDescription>
                </div>
                <StatusBadge status={lead.status} className="shrink-0" />
              </div>
              {/* Celular: as ações rolam na horizontal numa linha só, em vez de quebrar em duas */}
              <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>button]:h-10 [&>button]:shrink-0 sm:[&>button]:h-8">
                <Button size="sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                <Button size="sm" variant="secondary"><Phone className="h-3.5 w-3.5" /> Ligar</Button>
                <Button size="sm" variant="outline">Adicionar nota</Button>
                <Button size="sm" variant="outline">Próximo follow-up</Button>
              </div>
            </SheetHeader>
            <Tabs defaultValue="empresa" className="px-4 pt-4 sm:px-6">
              <TabsList className="grid h-10 w-full grid-cols-4 sm:h-9">
                <TabsTrigger value="empresa" className="px-1 text-[13px] sm:px-3 sm:text-sm">Empresa</TabsTrigger>
                <TabsTrigger value="instagram" className="px-1 text-[13px] sm:px-3 sm:text-sm">Instagram</TabsTrigger>
                <TabsTrigger value="comercial" className="px-1 text-[13px] sm:px-3 sm:text-sm">Comercial</TabsTrigger>
                <TabsTrigger value="timeline" className="px-1 text-[13px] sm:px-3 sm:text-sm">Timeline</TabsTrigger>
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
    <LeadFormDialog open={editing && !!lead} onOpenChange={setEditing} lead={lead} />
    </>
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
