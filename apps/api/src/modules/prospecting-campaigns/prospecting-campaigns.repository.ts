import { getSupabase } from "../../lib/supabase";

export interface ProspectingCampaignRow {
  id: string;
  name: string;
  owner_user_id: string;
  created_by_user_id: string;
  region: string | null;
  segment: string | null;
  filters: { cities: string[]; segments: string[] };
  schedule: Record<string, { enabled: boolean; limit: number }>;
  window_start: string;
  window_end: string;
  min_interval_ms: number;
  jitter_ms: number;
  is_active: boolean;
  session_mode: "until_done" | "custom" | null;
  session_start_at: string | null;
  session_end_at: string | null;
  created_at: string;
}

export async function findAll(): Promise<ProspectingCampaignRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("prospecting_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function findById(id: string): Promise<ProspectingCampaignRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("prospecting_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function findActiveWithConnectedInstance(): Promise<
  Array<ProspectingCampaignRow & { instance_name: string }>
> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("prospecting_campaigns")
    .select("*, bot_instances!inner(instance_name, status, owner_id)")
    .eq("is_active", true)
    .eq("bot_instances.channel", "whatsapp")
    .eq("bot_instances.status", "connected");

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    ...row,
    instance_name: row.bot_instances.instance_name,
  }));
}

export async function create(input: {
  name: string;
  ownerUserId: string;
  createdByUserId: string;
  region: string | null;
  segment: string | null;
  filters: { cities: string[]; segments: string[] };
  schedule: Record<string, { enabled: boolean; limit: number }>;
  windowStart: string;
  windowEnd: string;
}): Promise<ProspectingCampaignRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("prospecting_campaigns")
    .insert([
      {
        name: input.name,
        owner_user_id: input.ownerUserId,
        created_by_user_id: input.createdByUserId,
        region: input.region,
        segment: input.segment,
        filters: input.filters,
        schedule: input.schedule,
        window_start: input.windowStart,
        window_end: input.windowEnd,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function update(
  id: string,
  patch: Record<string, unknown>,
): Promise<ProspectingCampaignRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("prospecting_campaigns")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function toggleActive(id: string): Promise<ProspectingCampaignRow> {
  const campaign = await findById(id);
  if (!campaign) throw new Error("Campanha não encontrada.");
  return update(id, { is_active: !campaign.is_active });
}
