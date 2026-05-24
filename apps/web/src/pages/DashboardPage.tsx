import { Users, Target, TrendingUp, MessageSquare, DollarSign } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { leadsByDay, funnelData, leadsByCategory, leadsByCity } from "@/mock/data";

const pieColors = ["oklch(0.68 0.2 275)", "oklch(0.7 0.15 235)", "oklch(0.78 0.16 75)", "oklch(0.65 0.17 155)", "oklch(0.65 0.22 25)"];

export function DashboardPage() {
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral da operação de prospecção.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard label="Leads capturados" value="1.240" delta={12} icon={Users} accent="primary" />
        <MetricCard label="Leads prospectados" value="820" delta={8} icon={Target} accent="info" />
        <MetricCard label="Conversões" value="88" delta={4} icon={TrendingUp} accent="success" />
        <MetricCard label="Taxa de resposta" value="34%" delta={-2} icon={MessageSquare} accent="warning" />
        <MetricCard label="Vendas fechadas" value="R$ 184k" delta={18} icon={DollarSign} accent="success" />
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
              <AreaChart data={leadsByDay}>
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
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="capturados" stroke="oklch(0.68 0.2 275)" fill="url(#cap)" strokeWidth={2} />
                <Area type="monotone" dataKey="prospectados" stroke="oklch(0.7 0.15 235)" fill="url(#pro)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-1">Atividades recentes</h3>
          <p className="text-xs text-muted-foreground mb-4">Últimas movimentações</p>
          <ActivityTimeline
            events={[
              { id: "1", type: "create", title: "Lead Burger House criado", date: "agora", author: "Sistema" },
              { id: "2", type: "move", title: "Sakura Sushi movido para Negociação", date: "há 12min", author: "Ana Silva" },
              { id: "3", type: "call", title: "Ligação para Pizza Napoli", description: "Pediu proposta por email", date: "há 1h", author: "Carlos Mendes" },
              { id: "4", type: "contact", title: "Novo contato adicionado", date: "há 3h", author: "Júlia Costa" },
              { id: "5", type: "note", title: "Venda fechada — Café da Esquina", description: "R$ 2.400 / mês", date: "ontem", author: "Rafael Lima" },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Conversão do funil</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={funnelData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="stage" type="category" stroke="var(--muted-foreground)" fontSize={11} width={90} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
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
                <Pie data={leadsByCategory} dataKey="value" nameKey="name" outerRadius={70} innerRadius={40}>
                  {leadsByCategory.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Leads por cidade</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={leadsByCity}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={10} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="oklch(0.7 0.15 235)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
