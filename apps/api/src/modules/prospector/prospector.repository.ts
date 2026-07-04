import { getSupabase } from "../../lib/supabase";

export interface BotInstanceRow {
  id: string;
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

export async function findInstanceByChannel(channel: string): Promise<BotInstanceRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bot_instances")
    .select("*")
    .eq("channel", channel)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function upsertInstance(
  channel: string,
  instanceName: string,
  patch: Record<string, unknown>,
): Promise<BotInstanceRow> {
  const supabase = getSupabase();
  const existing = await findInstanceByChannel(channel);

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
    .insert([{ channel, instance_name: instanceName, ...patch }])
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

export async function getConfig(): Promise<BotConfigRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bot_config")
    .select("*")
    .limit(1)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateConfig(patch: Record<string, unknown>): Promise<BotConfigRow> {
  const supabase = getSupabase();
  const config = await getConfig();
  const { data, error } = await supabase
    .from("bot_config")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", config.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
