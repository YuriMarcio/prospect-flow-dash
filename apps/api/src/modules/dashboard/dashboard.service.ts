import * as dashboardRepository from "./dashboard.repository";

type LeadRow = Record<string, unknown>;

const statusLabels: Record<string, string> = {
  novo: "Capturados",
  contato: "Contato",
  qualificado: "Qualificados",
  negociacao: "Negociação",
  ganho: "Fechados",
  perdido: "Perdidos",
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getStatus(lead: LeadRow) {
  return text(lead.status, "novo");
}

function getDate(lead: LeadRow) {
  const value = text(lead.created_at, text(lead.createdAt));
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function countBy(leads: LeadRow[], key: string, fallback: string) {
  const counts = new Map<string, number>();

  for (const lead of leads) {
    const value = text(lead[key], fallback);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

function getRecentActivities(leads: LeadRow[]) {
  return leads.slice(0, 5).map((lead, index) => ({
    id: text(lead.id, `activity-${index}`),
    type: "create",
    title: `${text(lead.companyName, text(lead.company_name, text(lead.name, "Lead")))} criado`,
    date: formatDay(getDate(lead)),
    author: text(lead.owner, "Sistema"),
  }));
}

export async function getDashboardService() {
  const leads = await dashboardRepository.findDashboardLeads();
  const total = leads.length;
  const prospectados = leads.filter(
    (lead) => getStatus(lead) !== "novo",
  ).length;
  const ganhos = leads.filter((lead) => getStatus(lead) === "ganho").length;
  const contatoOuMais = leads.filter((lead) =>
    ["contato", "qualificado", "negociacao", "ganho"].includes(getStatus(lead)),
  ).length;
  const taxaResposta = total ? Math.round((contatoOuMais / total) * 100) : 0;

  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - index));
    return {
      date,
      day: formatDay(date),
      capturados: 0,
      prospectados: 0,
    };
  });

  for (const lead of leads) {
    const day = formatDay(getDate(lead));
    const bucket = days.find((item) => item.day === day);
    if (!bucket) continue;

    bucket.capturados += 1;
    if (getStatus(lead) !== "novo") bucket.prospectados += 1;
  }

  const funnelData = [
    "novo",
    "contato",
    "qualificado",
    "negociacao",
    "ganho",
  ].map((status) => ({
    stage: statusLabels[status],
    value: leads.filter((lead) => getStatus(lead) === status).length,
  }));

  return {
    metrics: {
      leadsCapturados: total,
      leadsProspectados: prospectados,
      conversoes: ganhos,
      taxaResposta,
      vendasFechadas: ganhos * 2400,
    },
    leadsByDay: days.map(({ date: _date, ...day }) => day),
    funnelData,
    leadsByCategory: countBy(leads, "category", "Sem categoria"),
    leadsByCity: countBy(leads, "city", "Sem cidade"),
    recentActivities: getRecentActivities(leads),
  };
}
