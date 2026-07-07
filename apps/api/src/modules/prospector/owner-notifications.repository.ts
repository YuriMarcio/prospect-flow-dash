import { getSupabase } from "../../lib/supabase";

export async function wasNotifiedSince(leadId: string, sinceIso: string): Promise<boolean> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("owner_notifications")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .gte("sent_at", sinceIso);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export async function insertNotification(input: {
  prospecting_campaign_id: string;
  lead_id: string;
  reason: string;
}): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("owner_notifications").insert([input]);
  if (error) throw new Error(error.message);
}
