import { request } from "@/lib/api";

export interface BotStatus {
  connected: boolean;
  is_active: boolean;
  todayCount: number;
  todayLimit: number;
  queueSize: number;
  activeMessage: BotMessage | null;
  warmingDone: boolean;
  filters: { cities: string[]; segments: string[] };
  sessionMode: "until_done" | "custom" | null;
  sessionStartAt: string | null;
  sessionEndAt: string | null;
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

export interface BotConfig {
  id: string;
  schedule: Record<"seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom", DaySchedule>;
  filters: { cities: string[]; segments: string[] };
  window_start: string;
  window_end: string;
  min_interval_ms: number;
  jitter_ms: number;
  is_active: boolean;
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

export async function connectWhatsapp(input: {
  instanceName: string;
  numberAge: "new" | "established";
}): Promise<{ qrcode: string | null }> {
  return request("/prospector/connect/whatsapp", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getBotStatus(): Promise<BotStatus> {
  return request("/prospector/status");
}

export async function getBotConfig(): Promise<BotConfig> {
  return request("/prospector/config");
}

export async function updateBotConfig(patch: Partial<BotConfig>): Promise<BotConfig> {
  return request("/prospector/config", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export async function toggleBot(): Promise<BotConfig> {
  return request("/prospector/toggle", { method: "POST" });
}

export async function startBotSession(input: {
  mode: "until_done" | "custom";
  startAt?: string;
  endAt?: string;
}): Promise<BotConfig> {
  return request("/prospector/session/start", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function stopBotSession(): Promise<BotConfig> {
  return request("/prospector/session/stop", { method: "POST" });
}

export async function listBotMessages(): Promise<BotMessage[]> {
  return request("/prospector/messages");
}

export async function createBotMessage(input: {
  title: string;
  status: BotMessage["status"];
  ab_limit?: number;
  reply_message_id?: string | null;
  blocks: MessageBlock[];
}): Promise<BotMessage> {
  return request("/prospector/messages", {
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

export async function buildQueueNow(): Promise<{ queued: number }> {
  return request("/prospector/queue/build", { method: "POST" });
}

export async function listDispatchQueue(): Promise<DispatchQueueItem[]> {
  return request("/prospector/queue");
}

export async function listBotLogs(): Promise<BotLog[]> {
  return request("/prospector/logs");
}

export async function listDispatchPlan(): Promise<DispatchPlanItem[]> {
  return request("/prospector/plan");
}

export async function assignLeadToDay(input: {
  leadId: string;
  date: string;
}): Promise<{ ok: boolean; reason?: string }> {
  return request("/prospector/plan", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function unassignLeadFromDay(leadId: string): Promise<void> {
  await request(`/prospector/plan/${leadId}`, { method: "DELETE" });
}
