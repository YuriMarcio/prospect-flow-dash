import { getSupabase } from "../../lib/supabase";

export interface DispatchPlanRow {
  id: string;
  prospecting_campaign_id: string;
  lead_id: string;
  planned_date: string;
  created_at: string;
}

export async function findAll(campaignId: string): Promise<DispatchPlanRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("dispatch_plan")
    .select("*")
    .eq("prospecting_campaign_id", campaignId);
  if (error) throw new Error(error.message);
  return data;
}

export async function findByDate(date: string, campaignId: string): Promise<DispatchPlanRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("dispatch_plan")
    .select("*")
    .eq("planned_date", date)
    .eq("prospecting_campaign_id", campaignId);
  if (error) throw new Error(error.message);
  return data;
}

export async function assign(leadId: string, date: string, campaignId: string): Promise<DispatchPlanRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("dispatch_plan")
    .upsert([{ lead_id: leadId, planned_date: date, prospecting_campaign_id: campaignId }], { onConflict: "lead_id" })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function unassign(leadId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("dispatch_plan").delete().eq("lead_id", leadId);
  if (error) throw new Error(error.message);
}

export async function removeMany(leadIds: string[]): Promise<void> {
  if (leadIds.length === 0) return;
  const supabase = getSupabase();
  const { error } = await supabase.from("dispatch_plan").delete().in("lead_id", leadIds);
  if (error) throw new Error(error.message);
}

export async function removeAllForCampaign(campaignId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("dispatch_plan").delete().eq("prospecting_campaign_id", campaignId);
  if (error) throw new Error(error.message);
}
