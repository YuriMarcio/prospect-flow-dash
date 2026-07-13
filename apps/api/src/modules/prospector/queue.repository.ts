import { getSupabase } from "../../lib/supabase";

export interface DispatchQueueRow {
  id: string;
  prospecting_campaign_id: string;
  lead_id: string;
  channel: string;
  message_id: string | null;
  flow_node_id: string | null;
  scheduled_at: string;
  status: "waiting" | "sending" | "sent" | "failed" | "replied";
  sent_at: string | null;
  response_text: string | null;
  response_at: string | null;
  response_classification: string | null;
  response_intent: string | null;
  response_ai: Record<string, unknown> | null;
  created_at: string;
}

export async function insertMany(rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = getSupabase();
  const { error } = await supabase.from("dispatch_queue").insert(rows);
  if (error) throw new Error(error.message);
}

export async function insertOne(row: Record<string, unknown>): Promise<DispatchQueueRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("dispatch_queue").insert([row]).select().single();
  if (error) throw new Error(error.message);
  return data;
}

/** Cancela todos os envios pendentes de uma campanha (botão "Limpar leads"). */
export async function removeWaitingForCampaign(campaignId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("dispatch_queue")
    .delete()
    .eq("prospecting_campaign_id", campaignId)
    .eq("status", "waiting");
  if (error) throw new Error(error.message);
}

/** Cancela envios pendentes de um lead (ex.: respondeu antes do follow-up sair). */
export async function removeWaitingForLead(leadId: string, campaignId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("dispatch_queue")
    .delete()
    .eq("lead_id", leadId)
    .eq("prospecting_campaign_id", campaignId)
    .eq("status", "waiting");
  if (error) throw new Error(error.message);
}

/**
 * Itens aguardando envio previstos até o fim de hoje. Diferente de
 * countToday("waiting"), ignora follow-ups agendados para dias futuros —
 * senão o modo "until_done" nunca consideraria a fila do dia concluída.
 */
export async function countWaitingDueToday(campaignId: string): Promise<number> {
  const supabase = getSupabase();
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const { count, error } = await supabase
    .from("dispatch_queue")
    .select("id", { count: "exact", head: true })
    .eq("prospecting_campaign_id", campaignId)
    .eq("status", "waiting")
    .lte("scheduled_at", endOfDay.toISOString());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function findDueItems(now: string, campaignId: string): Promise<DispatchQueueRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("dispatch_queue")
    .select("*")
    .eq("status", "waiting")
    .eq("prospecting_campaign_id", campaignId)
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function update(id: string, patch: Record<string, unknown>): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("dispatch_queue").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

// Global (não filtra por campanha) — evita que duas campanhas mandem mensagem
// pro mesmo lead compartilhado no mesmo dia.
export async function findLeadIdsQueuedToday(): Promise<string[]> {
  const supabase = getSupabase();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("dispatch_queue")
    .select("lead_id")
    .gte("created_at", startOfDay.toISOString());

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { lead_id: string }) => row.lead_id);
}

export async function countToday(campaignId: string, status?: string): Promise<number> {
  const supabase = getSupabase();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reassignar via .eq() condicional explode a inferência de tipo do query builder
  let query: any = supabase
    .from("dispatch_queue")
    .select("id", { count: "exact", head: true })
    .eq("prospecting_campaign_id", campaignId)
    .gte("created_at", startOfDay.toISOString());

  if (status) query = query.eq("status", status);

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function findMostRecentSentForLead(leadId: string): Promise<DispatchQueueRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("dispatch_queue")
    .select("*")
    .eq("lead_id", leadId)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function findMostRecentSentForCampaign(campaignId: string): Promise<DispatchQueueRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("dispatch_queue")
    .select("*")
    .eq("prospecting_campaign_id", campaignId)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function findRecentResponseTexts(sinceIso: string): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("dispatch_queue")
    .select("response_text")
    .not("response_text", "is", null)
    .gte("response_at", sinceIso);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { response_text: string }) => row.response_text);
}

export interface MetricsRow {
  status: string;
  response_intent: string | null;
  response_ai: { prontidao_para_reuniao?: string } | null;
  sent_at: string | null;
  response_at: string | null;
}

/** Colunas mínimas de todas as linhas da campanha, para agregar métricas. */
export async function findMetricsRows(campaignId: string): Promise<MetricsRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("dispatch_queue")
    .select("status, response_intent, response_ai, sent_at, response_at")
    .eq("prospecting_campaign_id", campaignId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function removeAllForCampaign(campaignId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("dispatch_queue").delete().eq("prospecting_campaign_id", campaignId);
  if (error) throw new Error(error.message);
}

/** Histórico completo de envios da campanha (todos os dias, não só hoje) — alimenta a coluna "Prospectados" do board. */
export async function findAllForCampaign(campaignId: string): Promise<DispatchQueueRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("dispatch_queue")
    .select("*")
    .eq("prospecting_campaign_id", campaignId)
    .order("scheduled_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function findAllForToday(campaignId: string): Promise<DispatchQueueRow[]> {
  const supabase = getSupabase();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("dispatch_queue")
    .select("*")
    .eq("prospecting_campaign_id", campaignId)
    .gte("created_at", startOfDay.toISOString())
    .order("scheduled_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}
