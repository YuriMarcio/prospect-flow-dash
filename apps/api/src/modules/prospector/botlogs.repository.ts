import { getSupabase } from "../../lib/supabase";

export async function create(
  message: string,
  level: "info" | "warn" | "error" = "info",
  campaignId?: string,
): Promise<void> {
  console.log(`[BOT] ${message}`);
  const supabase = getSupabase();
  const { error } = await supabase
    .from("bot_logs")
    .insert([{ message, level, prospecting_campaign_id: campaignId ?? null }]);
  if (error) console.error(`[BOT] Falha ao gravar log: ${error.message}`);
}

export async function findRecent(limit = 100) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bot_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data;
}

export async function detachCampaign(campaignId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("bot_logs")
    .update({ prospecting_campaign_id: null })
    .eq("prospecting_campaign_id", campaignId);
  if (error) console.error(`[BOT] Falha ao desvincular logs da campanha: ${error.message}`);
}

export async function findRecentByCampaign(campaignId: string, limit = 100) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bot_logs")
    .select("*")
    .eq("prospecting_campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data;
}
