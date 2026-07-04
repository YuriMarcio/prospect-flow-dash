import { getSupabase } from "../../lib/supabase";

export interface DispatchQueueRow {
  id: string;
  owner_id: string;
  lead_id: string;
  channel: string;
  message_id: string | null;
  scheduled_at: string;
  status: "waiting" | "sending" | "sent" | "failed" | "replied";
  sent_at: string | null;
  response_text: string | null;
  response_at: string | null;
  response_classification: string | null;
  created_at: string;
}

export async function insertMany(rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = getSupabase();
  const { error } = await supabase.from("dispatch_queue").insert(rows);
  if (error) throw new Error(error.message);
}

export async function findDueItems(now: string, ownerId: string): Promise<DispatchQueueRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("dispatch_queue")
    .select("*")
    .eq("status", "waiting")
    .eq("owner_id", ownerId)
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

export async function countToday(ownerId: string, status?: string): Promise<number> {
  const supabase = getSupabase();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reassignar via .eq() condicional explode a inferência de tipo do query builder
  let query: any = supabase
    .from("dispatch_queue")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
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

export async function findAllForToday(ownerId: string): Promise<DispatchQueueRow[]> {
  const supabase = getSupabase();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("dispatch_queue")
    .select("*")
    .eq("owner_id", ownerId)
    .gte("created_at", startOfDay.toISOString())
    .order("scheduled_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}
