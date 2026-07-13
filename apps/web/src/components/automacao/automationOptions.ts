import {
  CheckCircle2,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Store,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import instagramHero from "@/assets/automacao/instagram-hero.png";
import ifoodHero from "@/assets/automacao/ifood-hero.png";
import instadeliveryHero from "@/assets/automacao/instadelivery-hero.png";
import instagramLogo from "@/assets/automacao/instalogo.svg";
import ifoodLogo from "@/assets/automacao/ifood.svg";

export type AutomationFlowId = "instagram" | "ifood" | "instadelivery";

/** Badge pequeno ao lado do título: logo de marca real (imagem) ou ícone lucide sobre fundo colorido. */
export type AutomationLogo =
  | { kind: "image"; src: string; fit: "cover" | "contain"; bg?: string }
  | { kind: "icon"; icon: LucideIcon; bg: string };

export interface AutomationOption {
  id: AutomationFlowId;
  /** Ilustração 3D decorativa no canto do card (imagens enviadas pelo usuário). */
  heroSrc: string;
  logo: AutomationLogo;
  accent: "primary" | "destructive" | "info";
  title: string;
  subtitle: string;
  description: string;
  pills: { label: string; icon: LucideIcon }[];
  stats: { fonte: string; mediaLeads: string; tempoMedio: string };
  buttonLabel: string;
}

export const AUTOMATION_OPTIONS: AutomationOption[] = [
  {
    id: "instagram",
    heroSrc: instagramHero,
    logo: { kind: "image", src: instagramLogo, fit: "cover" },
    accent: "primary",
    title: "Descoberta via Instagram",
    subtitle: "Google Dorking",
    description: "Encontre perfis de empresas e negócios no Instagram ativo usando Google Dorking.",
    pills: [
      { label: "Alta precisão", icon: CheckCircle2 },
      { label: "Público qualificado", icon: Users },
      { label: "Rápida execução", icon: Zap },
    ],
    stats: { fonte: "site:instagram.com", mediaLeads: "100-500", tempoMedio: "10-20 min" },
    buttonLabel: "Configurar",
  },
  {
    id: "ifood",
    heroSrc: ifoodHero,
    logo: { kind: "image", src: ifoodLogo, fit: "contain", bg: "bg-white" },
    accent: "destructive",
    title: "Captura via iFood",
    subtitle: "Enriquecimento",
    description: "Extraia restaurantes ativos no iFood e enriqueça com Instagram e WhatsApp.",
    pills: [
      { label: "Dados completos", icon: CheckCircle2 },
      { label: "WhatsApp incluído", icon: MessageCircle },
      { label: "Enriquecimento", icon: Sparkles },
    ],
    stats: { fonte: "iFood + GeckoAPI", mediaLeads: "50-200", tempoMedio: "15-30 min" },
    buttonLabel: "Configurar",
  },
  {
    id: "instadelivery",
    heroSrc: instadeliveryHero,
    logo: { kind: "icon", icon: Store, bg: "bg-info" },
    accent: "info",
    title: "Captura via InstaDelivery",
    subtitle: "WhatsApp das lojas",
    description: "Raspe todas as lojas da cidade no portal InstaDelivery e extraia WhatsApp.",
    pills: [
      { label: "Todas as lojas", icon: Store },
      { label: "Scroll infinito", icon: RefreshCw },
      { label: "WhatsApp direto", icon: MessageCircle },
    ],
    stats: { fonte: "instadelivery.com", mediaLeads: "100-1.000", tempoMedio: "20-40 min" },
    buttonLabel: "Configurar",
  },
];
