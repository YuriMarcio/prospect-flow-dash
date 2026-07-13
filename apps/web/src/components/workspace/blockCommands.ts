import {
  Code2,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Lightbulb,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Paperclip,
  Quote,
  Table2,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { BlockType } from "@/lib/workspaceTypes";

export interface SlashCommandDef {
  type: BlockType;
  label: string;
  keywords: string;
  icon: LucideIcon;
  group: "Básico" | "Mídia" | "Avançado";
}

export const SLASH_COMMANDS: SlashCommandDef[] = [
  { type: "paragraph", label: "Texto", keywords: "text texto paragrafo", icon: Type, group: "Básico" },
  { type: "page", label: "Página", keywords: "page pagina subpagina sub", icon: FileText, group: "Básico" },
  { type: "h1", label: "Título 1", keywords: "h1 titulo heading", icon: Heading1, group: "Básico" },
  { type: "h2", label: "Título 2", keywords: "h2 titulo heading", icon: Heading2, group: "Básico" },
  { type: "h3", label: "Título 3", keywords: "h3 titulo heading", icon: Heading3, group: "Básico" },
  { type: "bullet", label: "Lista", keywords: "bullet lista", icon: List, group: "Básico" },
  { type: "number", label: "Lista numerada", keywords: "number numerada ordenada", icon: ListOrdered, group: "Básico" },
  { type: "todo", label: "Checklist", keywords: "todo checklist checkbox tarefa", icon: ListTodo, group: "Básico" },
  { type: "quote", label: "Citação", keywords: "quote citacao", icon: Quote, group: "Básico" },
  { type: "divider", label: "Divisor", keywords: "divider divisor hr", icon: Minus, group: "Básico" },
  { type: "image", label: "Imagem", keywords: "image imagem picture", icon: Image, group: "Mídia" },
  { type: "link", label: "Link", keywords: "link url", icon: Link2, group: "Mídia" },
  { type: "file", label: "Arquivo", keywords: "file arquivo attachment", icon: Paperclip, group: "Mídia" },
  { type: "code", label: "Código", keywords: "code codigo snippet", icon: Code2, group: "Avançado" },
  { type: "callout", label: "Callout", keywords: "callout tip dica nota", icon: Lightbulb, group: "Avançado" },
  { type: "table", label: "Tabela", keywords: "table tabela", icon: Table2, group: "Avançado" },
];

export function filterSlashCommands(query: string): SlashCommandDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((c) => c.label.toLowerCase().includes(q) || c.keywords.includes(q));
}

export const MARKDOWN_SHORTCUTS: { pattern: RegExp; type: BlockType }[] = [
  { pattern: /^#\s$/, type: "h1" },
  { pattern: /^##\s$/, type: "h2" },
  { pattern: /^###\s$/, type: "h3" },
  { pattern: /^[-*]\s$/, type: "bullet" },
  { pattern: /^\d+\.\s$/, type: "number" },
  { pattern: /^\[]\s$/, type: "todo" },
  { pattern: /^>\s$/, type: "quote" },
];
