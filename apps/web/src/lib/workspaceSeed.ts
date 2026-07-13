import type { Block, WorkspacePage } from "./workspaceTypes";

const now = new Date().toISOString();

function block(partial: Partial<Block> & Pick<Block, "type">): Block {
  return { id: crypto.randomUUID(), content: "", ...partial };
}

// Placeholder ilustrativo (mapa com pins), embutido como SVG — sem depender de rede.
const MAP_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="280" viewBox="0 0 800 280">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#312e81"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
  </defs>
  <rect width="800" height="280" fill="url(#g)"/>
  <g stroke="#4c1d95" stroke-width="1" opacity="0.4">
    ${Array.from({ length: 9 }, (_, i) => `<line x1="${i * 90}" y1="0" x2="${i * 90}" y2="280"/>`).join("")}
    ${Array.from({ length: 5 }, (_, i) => `<line x1="0" y1="${i * 70}" x2="800" y2="${i * 70}"/>`).join("")}
  </g>
  ${[
    [180, 90],
    [420, 130],
    [610, 80],
    [320, 190],
    [520, 210],
  ]
    .map(
      ([x, y]) => `
    <circle cx="${x}" cy="${y - 8}" r="10" fill="#f43f5e"/>
    <path d="M${x} ${y + 6} L${x - 8} ${y - 10} A10 10 0 1 1 ${x + 8} ${y - 10} Z" fill="#f43f5e"/>
  `,
    )
    .join("")}
</svg>`);

function estrategiaBlocks(): Block[] {
  return [
    block({ type: "h2", content: "Objetivo" }),
    block({ type: "paragraph", content: "Captar empresas locais com presença digital ativa e potencial de contratação." }),
    block({
      type: "callout",
      calloutKind: "idea",
      title: "Meta do mês",
      content: "Captar 1.000 leads qualificados e iniciar 200 conversas.",
    }),
    block({ type: "h2", content: "Canais de captação" }),
    block({ type: "todo", content: "Instagram", checked: true }),
    block({ type: "todo", content: "iFood", checked: true }),
    block({ type: "todo", content: "InstaDelivery", checked: false }),
    block({ type: "h2", content: "Estratégia" }),
    block({ type: "paragraph", content: "A abordagem será dividida entre descoberta, enriquecimento e contato." }),
    block({ type: "image", imageUrl: MAP_PLACEHOLDER, caption: "Áreas prioritárias de prospecção — julho 2026" }),
    block({
      type: "table",
      table: {
        headers: ["Canal", "Meta", "Capturados", "Conversão"],
        rows: [
          ["Instagram", "400", "287", "18%"],
          ["iFood", "400", "312", "24%"],
          ["InstaDelivery", "200", "98", "15%"],
        ],
      },
    }),
    block({
      type: "code",
      language: "javascript",
      content: "const estrategia = {\n  canal: 'Instagram',\n  meta: 400,\n  conversaoEsperada: '18%'\n};",
    }),
    block({
      type: "callout",
      calloutKind: "success",
      title: "Importante",
      content: "Acompanhar diariamente os resultados e ajustar abordagens quando necessário.",
    }),
  ];
}

function page(p: {
  id: string;
  icon: string;
  title: string;
  description?: string;
  parentId: string | null;
  order: number;
  favorite?: boolean;
  blocks?: Block[];
}): WorkspacePage {
  return {
    id: p.id,
    icon: p.icon,
    title: p.title,
    description: p.description ?? "",
    parentId: p.parentId,
    order: p.order,
    favorite: p.favorite ?? false,
    blocks: p.blocks ?? [block({ type: "paragraph", content: "" })],
    createdAt: now,
    updatedAt: now,
    updatedBy: "yurei",
  };
}

export function buildSeedPages(): Record<string, WorkspacePage> {
  const pages: WorkspacePage[] = [
    page({ id: "prospectai", icon: "🚀", title: "ProspectAI", parentId: null, order: 0 }),
    page({ id: "prospectai-visao", icon: "📄", title: "Visão do Produto", parentId: "prospectai", order: 0 }),
    page({ id: "prospectai-roadmap", icon: "📄", title: "Roadmap", parentId: "prospectai", order: 1, favorite: true }),
    page({ id: "prospectai-dev", icon: "📁", title: "Desenvolvimento", parentId: "prospectai", order: 2 }),
    page({ id: "prospectai-dev-arq", icon: "📄", title: "Arquitetura", parentId: "prospectai-dev", order: 0 }),
    page({ id: "prospectai-dev-api", icon: "📄", title: "API", parentId: "prospectai-dev", order: 1 }),
    page({ id: "prospectai-dev-db", icon: "📄", title: "Banco de Dados", parentId: "prospectai-dev", order: 2 }),

    page({ id: "prospeccao", icon: "📁", title: "Prospecção", parentId: null, order: 1 }),
    page({
      id: "prospeccao-estrategias",
      icon: "🚀",
      title: "Estratégia de Prospecção — Julho 2026",
      description: "Plano de captação e abordagem comercial para aquisição de novos clientes.",
      parentId: "prospeccao",
      order: 0,
      favorite: true,
      blocks: estrategiaBlocks(),
    }),
    page({ id: "prospeccao-scripts", icon: "📄", title: "Scripts de Abordagem", parentId: "prospeccao", order: 1 }),
    page({ id: "prospeccao-objecoes", icon: "📄", title: "Objeções", parentId: "prospeccao", order: 2 }),
    page({ id: "prospeccao-followups", icon: "📄", title: "Follow-ups", parentId: "prospeccao", order: 3 }),

    page({ id: "clientes", icon: "📁", title: "Clientes", parentId: null, order: 2 }),
    page({ id: "clientes-a", icon: "📄", title: "Cliente A", parentId: "clientes", order: 0 }),
    page({ id: "clientes-b", icon: "📄", title: "Cliente B", parentId: "clientes", order: 1 }),

    page({ id: "reunioes", icon: "📁", title: "Reuniões", parentId: null, order: 3 }),
    page({ id: "reunioes-1307", icon: "📄", title: "Reunião 13/07", parentId: "reunioes", order: 0 }),
    page({ id: "reunioes-0607", icon: "📄", title: "Reunião 06/07", parentId: "reunioes", order: 1 }),
  ];

  return Object.fromEntries(pages.map((p) => [p.id, p]));
}
