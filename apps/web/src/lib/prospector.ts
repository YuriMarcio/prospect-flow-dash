import { request } from "@/lib/api";

export interface InstanceStatus {
  connected: boolean;
  instanceName: string | null;
  warmingDone: boolean;
}

export interface CampaignStatus {
  connected: boolean;
  is_active: boolean;
  todayCount: number;
  todayLimit: number;
  queueSize: number;
  activeMessage: BotMessage | null;
  hasFlow: boolean;
  followupCount: number;
  warmingDone: boolean;
  filters: { cities: string[]; segments: string[] };
  sessionMode: "until_done" | "custom" | null;
  sessionStartAt: string | null;
  sessionEndAt: string | null;
}

export interface CampaignAiConfig {
  enabled: boolean;
  auto_reply_enabled: boolean;
  model?: string;
}

export interface CampaignNotificationConfig {
  enabled: boolean;
  phone: string | null;
  notify_on: string[];
  cooldown_minutes: number;
}

export interface DispatchPlanItem {
  id: string;
  lead_id: string;
  planned_date: string;
}

export interface DaySchedule {
  enabled: boolean;
  limit: number;
}

export type Schedule = Record<"seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom", DaySchedule>;

export interface ProspectingCampaign {
  id: string;
  name: string;
  owner_user_id: string;
  created_by_user_id: string;
  region: string | null;
  segment: string | null;
  filters: { cities: string[]; segments: string[] };
  schedule: Schedule;
  window_start: string;
  window_end: string;
  min_interval_ms: number;
  jitter_ms: number;
  is_active: boolean;
  session_mode: "until_done" | "custom" | null;
  session_start_at: string | null;
  session_end_at: string | null;
  ai_config: CampaignAiConfig | null;
  notification_config: CampaignNotificationConfig | null;
  created_at: string;
}

export interface MessageBlock {
  id?: string;
  type: "text" | "image" | "audio";
  content: string;
  caption?: string | null;
}

export interface BotMessage {
  id: string;
  title: string;
  status: "active" | "draft" | "ab-test";
  ab_limit: number | null;
  ab_used_count: number;
  reply_message_id: string | null;
  bot_message_blocks: MessageBlock[];
}

export interface DispatchQueueItem {
  id: string;
  lead_id: string;
  channel: string;
  status: "waiting" | "sending" | "sent" | "failed" | "replied";
  scheduled_at: string;
  sent_at: string | null;
}

export interface BotLog {
  id: string;
  level: string;
  message: string;
  created_at: string;
}

// ─── Conexão de WhatsApp (por usuário logado) ────────────────────────────────

export async function connectWhatsapp(input: {
  instanceName: string;
  numberAge: "new" | "established";
}): Promise<{ qrcode: string | null }> {
  return request("/prospector/connect/whatsapp", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getInstanceStatus(): Promise<InstanceStatus> {
  return request("/prospector/instance-status");
}

// ─── Campanhas de prospecção ──────────────────────────────────────────────────

export async function listCampaigns(): Promise<ProspectingCampaign[]> {
  return request("/prospecting-campaigns");
}

export async function getCampaign(id: string): Promise<ProspectingCampaign> {
  return request(`/prospecting-campaigns/${id}`);
}

export async function createCampaign(input: {
  name: string;
  ownerUserId: string;
  region?: string | null;
  segment?: string | null;
  filters?: { cities: string[]; segments: string[] };
  schedule?: Schedule;
  windowStart?: string;
  windowEnd?: string;
}): Promise<ProspectingCampaign> {
  return request("/prospecting-campaigns", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteCampaign(id: string): Promise<void> {
  await request(`/prospecting-campaigns/${id}`, { method: "DELETE" });
}

export async function updateCampaign(
  id: string,
  patch: Partial<
    Pick<
      ProspectingCampaign,
      "schedule" | "filters" | "window_start" | "window_end" | "ai_config" | "notification_config"
    >
  >,
): Promise<ProspectingCampaign> {
  return request(`/prospecting-campaigns/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function toggleCampaign(id: string): Promise<ProspectingCampaign> {
  return request(`/prospecting-campaigns/${id}/toggle`, { method: "POST" });
}

export async function getCampaignStatus(id: string): Promise<CampaignStatus> {
  return request(`/prospecting-campaigns/${id}/status`);
}

export async function startCampaignSession(
  id: string,
  input: { mode: "until_done" | "custom"; startAt?: string; endAt?: string },
): Promise<ProspectingCampaign> {
  return request(`/prospecting-campaigns/${id}/session/start`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function stopCampaignSession(id: string): Promise<ProspectingCampaign> {
  return request(`/prospecting-campaigns/${id}/session/stop`, { method: "POST" });
}

// ─── Mensagens (por campanha) ─────────────────────────────────────────────────

export async function listBotMessages(campaignId: string): Promise<BotMessage[]> {
  return request(`/prospector/messages?campaignId=${campaignId}`);
}

export async function createBotMessage(
  campaignId: string,
  input: {
    title: string;
    status: BotMessage["status"];
    ab_limit?: number;
    reply_message_id?: string | null;
    blocks: MessageBlock[];
  },
): Promise<BotMessage> {
  return request(`/prospector/messages?campaignId=${campaignId}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateBotMessage(
  id: string,
  patch: Partial<Omit<BotMessage, "bot_message_blocks">> & { blocks?: MessageBlock[] },
): Promise<BotMessage> {
  return request(`/prospector/messages/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function deleteBotMessage(id: string): Promise<void> {
  await request(`/prospector/messages/${id}`, { method: "DELETE" });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function uploadBotMedia(file: File): Promise<{ url: string }> {
  const dataBase64 = await readFileAsBase64(file);
  return request("/prospector/media", {
    method: "POST",
    body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataBase64 }),
  });
}

// ─── Fila e plano (por campanha) ──────────────────────────────────────────────

export async function buildQueueNow(campaignId: string): Promise<{ queued: number }> {
  return request(`/prospector/queue/build?campaignId=${campaignId}`, { method: "POST" });
}

export async function listDispatchQueue(campaignId: string): Promise<DispatchQueueItem[]> {
  return request(`/prospector/queue?campaignId=${campaignId}`);
}

export async function listBotLogs(campaignId?: string): Promise<BotLog[]> {
  return request(campaignId ? `/prospector/logs?campaignId=${campaignId}` : "/prospector/logs");
}

export async function listDispatchPlan(campaignId: string): Promise<DispatchPlanItem[]> {
  return request(`/prospector/plan?campaignId=${campaignId}`);
}

export async function assignLeadToDay(input: {
  leadId: string;
  date: string;
  campaignId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  return request("/prospector/plan", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function unassignLeadFromDay(leadId: string): Promise<void> {
  await request(`/prospector/plan/${leadId}`, { method: "DELETE" });
}
