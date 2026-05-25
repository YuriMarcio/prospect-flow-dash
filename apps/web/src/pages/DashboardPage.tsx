import { useQuery } from "@tanstack/react-query";
import { Users, Target, TrendingUp, MessageSquare, DollarSign } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { MetricCard } from "@/components/MetricCard";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { getDashboard, type DashboardData } from "@/lib/api";

const pieColors = [
  "oklch(0.68 0.2 275)",
  "oklch(0.7 0.15 235)",
  "oklch(0.78 0.16 75)",
  "oklch(0.65 0.17 155)",
  "oklch(0.65 0.22 25)",
];

const emptyDashboard: DashboardData = {
  metrics: {
    leadsCapturados: 0,
    leadsProspectados: 0,
    conversoes: 0,
    taxaResposta: 0,
    vendasFechadas: 0,
  },
  leadsByDay: [],
  funnelData: [],
  leadsByCategory: [],
  leadsByCity: [],
  recentActivities: [],
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function DashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
    retry: 1,
  });
  const dashboard = dashboardQuery.data ?? emptyDashboard;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {dashboardQuery.isLoading
              ? "Carregando visão geral..."
              : "Visão geral da operação de prospecção."}
          </p>
          {dashboardQuery.isError && (
            <p className="text-sm text-destructive mt-1">
              Não foi possível carregar os dados do dashboard.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Leads capturados"
          value={dashboard.metrics.leadsCapturados.toLocaleString("pt-BR")}
          delta={0}
          icon={Users}
          accent="primary"
        />
        <MetricCard
          label="Leads prospectados"
          value={dashboard.metrics.leadsProspectados.toLocaleString("pt-BR")}
          delta={0}
          icon={Target}
          accent="info"
        />
        <MetricCard
          label="Conversões"
          value={dashboard.metrics.conversoes.toLocaleString("pt-BR")}
          delta={0}
          icon={TrendingUp}
          accent="success"
        />
        <MetricCard
          label="Taxa de resposta"
          value={`${dashboard.metrics.taxaResposta}%`}
          delta={0}
          icon={MessageSquare}
          accent="warning"
        />
        <MetricCard
          label="Vendas fechadas"
          value={formatCurrency(dashboard.metrics.vendasFechadas)}
          delta={0}
          icon={DollarSign}
          accent="success"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold">Leads por dia</h3>
              <p className="text-xs text-muted-foreground">Últimos 14 dias</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={dashboard.leadsByDay}>
                <defs>
                  <linearGradient id="cap" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.68 0.2 275)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.68 0.2 275)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="pro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.7 0.15 235)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.7 0.15 235)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="capturados"
                  stroke="oklch(0.68 0.2 275)"
                  fill="url(#cap)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="prospectados"
                  stroke="oklch(0.7 0.15 235)"
                  fill="url(#pro)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-1">Atividades recentes</h3>
          <p className="text-xs text-muted-foreground mb-4">Últimas movimentações</p>
          {dashboard.recentActivities.length > 0 ? (
            <ActivityTimeline events={dashboard.recentActivities} />
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma atividade encontrada.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Conversão do funil</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={dashboard.funnelData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis
                  dataKey="stage"
                  type="category"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  width={90}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" fill="oklch(0.68 0.2 275)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Leads por categoria</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={dashboard.leadsByCategory}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={70}
                  innerRadius={40}
                >
                  {dashboard.leadsByCategory.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Leads por cidade</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={dashboard.leadsByCity}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={10} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" fill="oklch(0.7 0.15 235)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
