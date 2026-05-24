import { supabase } from "../../lib/supabase";

export async function findByCampaignId(campaignId: string) {
  const { data, error } = await supabase
    .from("logs")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  
  if (error) throw new Error(error.message);
  return data;
}

// O worker usará essa função internamente para salvar os logs
export async function create(campaignId: string, message: string, level: string = "info") {
  const { data, error } = await supabase
    .from("logs")
    .insert([{ campaign_id: campaignId, message, level }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}