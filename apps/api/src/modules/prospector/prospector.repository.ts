import { getSupabase } from "../../lib/supabase";

export interface BotInstanceRow {
  id: string;
  owner_id: string;
  channel: string;
  instance_name: string;
  status: string;
  qr_code: string | null;
  connected_at: string | null;
  number_age: string | null;
  warming_done: boolean;
  daily_limit: number;
  created_at: string;
}

export interface BotConfigRow {
  id: string;
  owner_id: string;
  schedule: Record<string, { enabled: boolean; limit: number }>;
  filters: { cities: string[]; segments: string[] };
  window_start: string;
  window_end: string;
  min_interval_ms: number;
  jitter_ms: number;
  is_active: boolean;
  session_mode: "until_done" | "custom" | null;
  session_start_at: string | null;
  session_end_at: string | null;
  updated_at: string;
}

const DEFAULT_CONFIG = {
  schedule: {
    dom: { enabled: false, limit: 0 },
    seg: { enabled: true, limit: 80 },
    ter: { enabled: true, limit: 80 },
    qua: { enabled: true, limit: 80 },
    qui: { enabled: true, limit: 80 },
    sex: { enabled: true, limit: 80 },
    sab: { enabled: false, limit: 0 },
  },
  filters: { cities: [], segments: [] },
  window_start: "08:00",
  window_end: "18:00",
  min_interval_ms: 900_000,
  jitter_ms: 180_000,
  is_active: false,
};

export async function findInstanceByChannel(channel: string, ownerId: string): Promise<BotInstanceRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bot_instances")
    .select("*")
    .eq("channel", channel)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function findInstanceByName(instanceName: string): Promise<BotInstanceRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bot_instances")
    .select("*")
    .eq("instance_name", instanceName)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function findAllConnectedInstances(channel: string): Promise<BotInstanceRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bot_instances")
    .select("*")
    .eq("channel", channel)
    .eq("status", "connected");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertInstance(
  channel: string,
  ownerId: string,
  instanceName: string,
  patch: Record<string, unknown>,
): Promise<BotInstanceRow> {
  const supabase = getSupabase();
  const existing = await findInstanceByChannel(channel, ownerId);

  if (existing) {
    const { data, error } = await supabase
      .from("bot_instances")
      .update({ ...patch, instance_name: instanceName })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabase
    .from("bot_instances")
    .insert([{ channel, owner_id: ownerId, instance_name: instanceName, ...patch }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateInstance(
  instanceName: string,
  patch: Record<string, unknown>,
): Promise<BotInstanceRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bot_instances")
    .update(patch)
    .eq("instance_name", instanceName)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function listConfiguredOwnerIds(): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("bot_config").select("owner_id");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { owner_id: string }) => row.owner_id);
}

export async function getConfig(ownerId: string): Promise<BotConfigRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bot_config")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) return data;

  const { data: created, error: insertError } = await supabase
    .from("bot_config")
    .insert([{ ...DEFAULT_CONFIG, owner_id: ownerId }])
    .select()
    .single();

  if (insertError) throw new Error(insertError.message);
  return created;
}

export async function updateConfig(ownerId: string, patch: Record<string, unknown>): Promise<BotConfigRow> {
  const supabase = getSupabase();
  const config = await getConfig(ownerId);
  const { data, error } = await supabase
    .from("bot_config")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", config.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
