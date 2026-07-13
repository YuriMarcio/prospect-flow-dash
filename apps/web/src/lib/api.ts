import type { Capture, Lead, LeadStatus, TimelineEvent } from "@/types";
import { useAuthStore } from "@/store/auth";

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3333").replace(/\/$/, "");

type ApiLead = Record<string, unknown>;
type ApiCampaign = Record<string, unknown>;
type ApiLog = Record<string, unknown>;

export interface CreateCampaignInput {
  category: string;
  city: string;
  neighborhood?: string;
  quantity: number;
}

export interface DashboardData {
  metrics: {
    leadsCapturados: number;
    leadsProspectados: number;
    conversoes: number;
    taxaResposta: number;
    vendasFechadas: number;
  };
  leadsByDay: { day: string; capturados: number; prospectados: number }[];
  funnelData: { stage: string; value: number }[];
  leadsByCategory: { name: string; value: number }[];
  leadsByCity: { name: string; value: number }[];
  recentActivities: TimelineEvent[];
}

const statusByColumnId: Record<string, LeadStatus> = {
  "col-1": "novo",
  "col-2": "contato",
  "col-3": "negociacao",
  "col-4": "ganho",
  "col-5": "perdido",
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

// Aceita URL completa (https://www.instagram.com/username/) ou só o username
function instagramUsername(value: unknown): string | undefined {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return undefined;
  const match = raw.match(/instagram\.com\/([^/?#]+)/);
  if (match) return match[1] || undefined;
  return raw.replace(/^@/, "") || undefined;
}

function number(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function array(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

// bio_links vem do Instagram como [{ url: string }] — extrai só as URLs
function bioLinkUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "object" && item && "url" in item ? (item as { url: unknown }).url : undefined))
    .filter((url): url is string => typeof url === "string" && url.trim().length > 0);
}

function status(value: unknown): LeadStatus {
  const allowed = ["novo", "contato", "qualificado", "negociacao", "ganho", "perdido"];
  return typeof value === "string" && allowed.includes(value) ? (value as LeadStatus) : "novo";
}

function timeline(value: unknown): TimelineEvent[] {
  if (Array.isArray(value)) return value as TimelineEvent[];

  return [
    {
      id: "created",
      type: "create",
      title: "Lead criado",
      date: "agora",
      author: "Sistema",
    },
  ];
}

function captureStatus(value: unknown): Capture["status"] {
  if (value === "running") return "running";
  if (value === "done" || value === "completed" || value === "finished") return "done";
  if (value === "error" || value === "failed") return "error";
  if (value === "cancelled") return "cancelled";
  return "queued";
}

function formatDate(value: unknown) {
  const date = typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeLog(log: ApiLog): Capture["logs"][number] {
  const level = log.level === "warn" || log.level === "error" ? log.level : "info";

  return {
    time: formatDate(log.created_at),
    message: text(log.message, "Log sem mensagem"),
    level,
  };
}

function normalizeCampaign(campaign: ApiCampaign): Capture {
  const status = captureStatus(campaign.status);
  const quantity = number(campaign.quantity, number(campaign.limit, 0));
  const processed = number(
    campaign.processed,
    status === "done" ? quantity : number(campaign.processed_count, 0),
  );

  return {
    id: text(campaign.id),
    category: text(campaign.category, "Sem categoria"),
    city: text(campaign.city, "Sem cidade"),
    neighborhood: text(campaign.neighborhood, undefined),
    quantity,
    delay: number(campaign.delay, 0),
    limit: number(campaign.limit, quantity),
    status,
    processed,
    found: number(campaign.found, number(campaign.found_count, 0)),
    errors: number(campaign.errors, number(campaign.error_count, 0)),
    duration: text(campaign.duration, "—"),
    startedAt: formatDate(campaign.started_at ?? campaign.created_at),
    startedAtRaw: text(campaign.started_at ?? campaign.created_at, undefined),
    logs: Array.isArray(campaign.logs) ? campaign.logs.map((log) => normalizeLog(log)) : [],
  };
}

function normalizeLead(lead: ApiLead): Lead {
  const leadStatus = status(lead.status);
  const columnId = text(lead.columnId, text(lead.column_id, ""));

  return {
    id: text(lead.id),
    companyName: text(lead.companyName, text(lead.company_name, text(lead.name, "Lead sem nome"))),
    cnpj: text(lead.cnpj, undefined),
    category: text(lead.category, text(lead.description, "Sem categoria")),
    city: text(lead.city, "Sem cidade"),
    address: text(lead.address, undefined),
    phone: text(lead.phone, text(lead.whatsapp, text(lead.fiscal_phones, ""))),
    instagram: instagramUsername(lead.instagram) ?? instagramUsername(lead.instagram_url),
    instagramBio: text(lead.instagramBio, text(lead.instagram_bio, text(lead.biography, text(lead.notes, undefined)))),
    followers: typeof lead.followers === "number" && (lead.followers as number) > 0 ? (lead.followers as number) : undefined,
    links: [
      ...new Set([
        ...array(lead.links),
        ...array(lead.ifood_url),
        ...array(lead.linktree),
        ...array(lead.digital_menu),
        ...array(lead.delivery_link),
        ...array(lead.external_url),
        ...bioLinkUrls(lead.bio_links),
      ]),
    ].filter(Boolean),
    score: number(lead.score, 50),
    status: leadStatus,
    tags: array(lead.tags),
    owner: text(lead.owner, text(lead.responsible, "Sem responsável")),
    columnId:
      columnId ||
      Object.entries(statusByColumnId).find(([, s]) => s === leadStatus)?.[0] ||
      "col-1",
    lastInteraction: text(lead.lastInteraction, text(lead.last_interaction, "sem interação")),
    nextFollowUp: text(lead.nextFollowUp, text(lead.next_follow_up, undefined)),
    timeline: timeline(lead.timeline),
    createdAt: typeof lead.created_at === "string" ? lead.created_at : undefined,
    prospectingChannel: (["whatsapp", "instagram", "email"].includes(lead.prospecting_channel as string)
      ? lead.prospecting_channel
      : undefined) as Lead["prospectingChannel"],
    meetingAt: typeof lead.meeting_at === "string" ? lead.meeting_at : undefined,
    meetingNotes: text(lead.meeting_notes, undefined),
  };
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body != null;
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    ...init,
  });

  if (response.status === 401 && path !== "/auth/login") {
    useAuthStore.getState().clear();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
  }

  if (!response.ok) {
    // Propaga a mensagem de erro do backend (ex.: validação do fluxo) quando houver
    const body = await response.json().catch(() => null);
    const message = body && typeof body.error === "string" ? body.error : null;
    throw new Error(message ?? `API respondeu com erro ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export interface AuthUser {
  id: string;
  username: string | null;
  email: string | null;
  name: string | null;
  phone: string | null;
}

export async function login(username: string, password: string): Promise<AuthUser> {
  return request<AuthUser>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function listUsers(): Promise<AuthUser[]> {
  return request<AuthUser[]>("/auth/users");
}

export async function getMe(): Promise<AuthUser> {
  return request<AuthUser>("/auth/me");
}

export async function updateProfile(patch: { name?: string; phone?: string | null }): Promise<AuthUser> {
  return request<AuthUser>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function loginWithGoogle(credential: string): Promise<AuthUser> {
  return request<AuthUser>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
}

export async function logout(): Promise<void> {
  await request<void>("/auth/logout", { method: "POST" });
}

export async function listLeads() {
  const leads = await request<ApiLead[]>("/leads");
  return leads.map(normalizeLead);
}

export async function getDashboard() {
  return request<DashboardData>("/dashboard");
}

export async function listCampaigns() {
  const campaigns = await request<ApiCampaign[]>("/campaigns");
  return campaigns.map(normalizeCampaign);
}

export async function createCampaign(input: CreateCampaignInput) {
  const campaign = await request<ApiCampaign>("/campaigns/campaignleadsearch", {
    method: "POST", // Changed from GET to POST
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return normalizeCampaign(campaign);
}

export async function startCampaign(id: string) {
  const campaign = await request<ApiCampaign>(`/campaigns/${id}/start`, {
    method: "POST",
  });

  return normalizeCampaign(campaign);
}

export async function stopCampaign(id: string) {
  const campaign = await request<ApiCampaign>(`/campaigns/${id}/stop`, {
    method: "POST",
  });

  return normalizeCampaign(campaign);
}

export async function listCampaignLogs(campaignId: string) {
  const logs = await request<ApiLog[]>(`/logs/campaign/${campaignId}`);
  return logs.map(normalizeLog);
}

export async function updateLead(id: string, patch: Partial<Lead>) {
  const body: Record<string, unknown> = {};
  if (patch.status) body.status = patch.status;
  if (patch.columnId) body.column_id = patch.columnId;
  if (patch.nextFollowUp) body.next_follow_up = patch.nextFollowUp;
  if (patch.lastInteraction) body.last_interaction = patch.lastInteraction;
  if (patch.score !== undefined) body.score = patch.score;
  if (patch.tags) body.tags = patch.tags;
  if (patch.owner) body.owner = patch.owner;
  if (patch.prospectingChannel !== undefined) body.prospecting_channel = patch.prospectingChannel;
  if (patch.meetingAt !== undefined) body.meeting_at = patch.meetingAt || null;
  if (patch.meetingNotes !== undefined) body.meeting_notes = patch.meetingNotes || null;

  const lead = await request<ApiLead>(`/leads/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  return normalizeLead(lead);
}

export async function deduplicateLeads(): Promise<{ removed: number }> {
  return request<{ removed: number }>("/leads/dedup", { method: "POST" });
}

export function getStatusForColumn(columnId: string) {
  return statusByColumnId[columnId];
}

export async function createIfoodCampaign(input: {
  category: string;
  city: string;
  zipCode: string;
  quantity: number;
}): Promise<Capture> {
  const campaign = await request<ApiCampaign>("/campaigns/campaignifood", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return normalizeCampaign(campaign);
}

export async function getInstaDeliveryCities(): Promise<string[]> {
  return request<string[]>("/campaigns/instadelivery/cities");
}

export async function createInstaDeliveryCampaign(input: {
  city: string;
  quantity: number;
}): Promise<Capture> {
  const campaign = await request<ApiCampaign>("/campaigns/campaigninstadelivery", {
    method: "POST",
    body: JSON.stringify({
      city: input.city,
      quantity: input.quantity,
      category: "Delivery",
    }),
  });
  return normalizeCampaign(campaign);
}
