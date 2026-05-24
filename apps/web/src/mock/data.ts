import type { Lead, KanbanColumn, Capture } from "@/types";

export const defaultColumns: KanbanColumn[] = [
  { id: "col-1", title: "A Prospectar", color: "oklch(0.7 0.05 260)", order: 0 },
  { id: "col-2", title: "Em Prospecção", color: "oklch(0.7 0.15 235)", order: 1 },
  { id: "col-3", title: "Negociação", color: "oklch(0.78 0.16 75)", order: 2 },
  { id: "col-4", title: "Venda Fechada", color: "oklch(0.65 0.17 155)", order: 3 },
  { id: "col-5", title: "Perdido", color: "oklch(0.62 0.2 25)", order: 4 },
];

const categories = ["Hamburgueria", "Pizzaria", "Restaurante Japonês", "Açaí", "Cafeteria", "Padaria", "Sorveteria"];
const cities = ["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Curitiba", "Porto Alegre", "Florianópolis"];
const owners = ["Ana Silva", "Carlos Mendes", "Júlia Costa", "Rafael Lima"];
const tagPool = ["quente", "frio", "premium", "decisor", "follow-up", "interessado", "indicação"];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randTags() {
  const n = 1 + Math.floor(Math.random() * 3);
  const set = new Set<string>();
  while (set.size < n) set.add(rand(tagPool));
  return [...set];
}

const names = [
  "Burger House", "Sakura Sushi", "Pizza Napoli", "Açaí Tropical", "Café da Esquina",
  "Padaria São José", "Gelato Bella", "Yamato Temakeria", "Pizzaria Bambino", "Hamburgueria do Zé",
  "Coffee Lab", "Açaí Power", "Sushi Bar Tokyo", "Pizza & Cia", "Burger Station",
  "Doce Encanto", "Verde Folha Salads", "La Pasta Italiana", "Boteco do Centro", "Pizza Express",
];

export const mockLeads: Lead[] = names.map((name, i) => {
  const colIdx = i % 5;
  const status: Lead["status"] = (["novo", "contato", "qualificado", "negociacao", "ganho"] as const)[colIdx];
  const city = rand(cities);
  return {
    id: `lead-${i + 1}`,
    companyName: name,
    cnpj: `${10 + i}.${100 + i}.${200 + i}/0001-${10 + i}`,
    category: rand(categories),
    city,
    address: `Rua das Flores, ${100 + i * 7} - ${city}`,
    phone: `(11) 9${Math.floor(1000 + Math.random() * 8999)}-${Math.floor(1000 + Math.random() * 8999)}`,
    instagram: `@${name.toLowerCase().replace(/[^a-z]/g, "")}`,
    instagramBio: "Comida boa, atendimento melhor ainda 🍔",
    followers: 1200 + Math.floor(Math.random() * 50000),
    links: ["https://wa.me/5511999999999", "https://ifood.com.br"],
    score: 40 + Math.floor(Math.random() * 60),
    status,
    tags: randTags(),
    owner: rand(owners),
    columnId: `col-${colIdx + 1}`,
    lastInteraction: `${1 + Math.floor(Math.random() * 14)}d atrás`,
    nextFollowUp: "Amanhã 14:00",
    timeline: [
      { id: "t1", type: "create", title: "Lead criado", date: "há 5 dias", author: "Sistema" },
      { id: "t2", type: "call", title: "Ligação realizada", description: "Cliente pediu para retornar terça.", date: "há 3 dias", author: rand(owners) },
      { id: "t3", type: "note", title: "Observação", description: "Tem interesse em plano premium.", date: "há 2 dias", author: rand(owners) },
      { id: "t4", type: "move", title: "Movido para Negociação", date: "há 1 dia", author: rand(owners) },
    ],
  };
});

export const mockCaptures: Capture[] = [
  {
    id: "cap-1", category: "Hamburgueria", city: "São Paulo", neighborhood: "Vila Mariana",
    quantity: 200, delay: 3, limit: 500, status: "running", processed: 124, found: 98, errors: 2,
    duration: "00:14:22", startedAt: "Hoje 09:14",
    logs: [
      { time: "09:14:02", message: "Iniciando captura iFood", level: "info" },
      { time: "09:15:30", message: "42 estabelecimentos encontrados", level: "info" },
      { time: "09:18:11", message: "Rate limit detectado, aguardando 5s", level: "warn" },
    ],
  },
  {
    id: "cap-2", category: "Pizzaria", city: "Rio de Janeiro", neighborhood: "Copacabana",
    quantity: 150, delay: 2, limit: 300, status: "done", processed: 150, found: 142, errors: 0,
    duration: "00:09:48", startedAt: "Ontem 18:02",
    logs: [{ time: "18:11:50", message: "Captura concluída com sucesso", level: "info" }],
  },
  {
    id: "cap-3", category: "Açaí", city: "Curitiba", quantity: 80, delay: 4, limit: 200,
    status: "error", processed: 32, found: 18, errors: 5, duration: "00:04:12", startedAt: "Ontem 14:30",
    logs: [{ time: "14:34:42", message: "Falha de conexão com API iFood", level: "error" }],
  },
  {
    id: "cap-4", category: "Cafeteria", city: "Belo Horizonte", quantity: 100, delay: 3, limit: 250,
    status: "queued", processed: 0, found: 0, errors: 0, duration: "—", startedAt: "—", logs: [],
  },
];

export const leadsByDay = Array.from({ length: 14 }).map((_, i) => ({
  day: `${i + 1}/05`,
  capturados: 20 + Math.floor(Math.random() * 50),
  prospectados: 10 + Math.floor(Math.random() * 30),
}));

export const funnelData = [
  { stage: "Capturados", value: 1240 },
  { stage: "Contato", value: 820 },
  { stage: "Qualificados", value: 460 },
  { stage: "Negociação", value: 210 },
  { stage: "Fechados", value: 88 },
];

export const leadsByCategory = categories.slice(0, 5).map((c) => ({
  name: c, value: 50 + Math.floor(Math.random() * 200),
}));

export const leadsByCity = cities.map((c) => ({
  name: c, value: 80 + Math.floor(Math.random() * 220),
}));
