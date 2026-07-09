import { getSupabase } from "../../lib/supabase";

export type LeadFlowStatus =
  | "active"
  | "waiting_dispatch"
  | "waiting_timer"
  | "processing"
  | "completed"
  | "stopped";

export interface LeadFlowStateRow {
  id: string;
  lead_id: string;
  prospecting_campaign_id: string;
  flow_id: string;
  current_node_id: string | null;
  status: LeadFlowStatus;
  wait_until: string | null;
  last_dispatch_id: string | null;
  entered_node_at: string;
  updated_at: string;
}

export async function upsertState(input: {
  lead_id: string;
  prospecting_campaign_id: string;
  flow_id: string;
  current_node_id: string | null;
  status: LeadFlowStatus;
  wait_until?: string | null;
  last_dispatch_id?: string | null;
}): Promise<void> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const { error } = await supabase.from("lead_flow_states").upsert(
    [
      {
        lead_id: input.lead_id,
        prospecting_campaign_id: input.prospecting_campaign_id,
        flow_id: input.flow_id,
        current_node_id: input.current_node_id,
        status: input.status,
        wait_until: input.wait_until ?? null,
        last_dispatch_id: input.last_dispatch_id ?? null,
        entered_node_at: now,
        updated_at: now,
      },
    ],
    { onConflict: "lead_id,prospecting_campaign_id" },
  );
  if (error) throw new Error(error.message);
}

export async function findByLeadAndCampaign(
  leadId: string,
  campaignId: string,
): Promise<LeadFlowStateRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("lead_flow_states")
    .select("*")
    .eq("lead_id", leadId)
    .eq("prospecting_campaign_id", campaignId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Timers vencidos (wait_until nulo = aguarda indefinidamente, nunca vence). */
export async function findDueTimers(campaignId: string, nowIso: string): Promise<LeadFlowStateRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("lead_flow_states")
    .select("*")
    .eq("prospecting_campaign_id", campaignId)
    .eq("status", "waiting_timer")
    .not("wait_until", "is", null)
    .lte("wait_until", nowIso);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Claim atômico do timer (mesmo padrão do claimForCampaign de leads): só um
 * tick processa cada estado, mesmo se dois ticks se sobrepuserem.
 */
export async function claimTimer(id: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("lead_flow_states")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "waiting_timer")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function updateState(id: string, patch: Record<string, unknown>): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("lead_flow_states")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Para o fluxo de todos os leads da campanha (botão "Limpar leads"). */
export async function stopAllForCampaign(campaignId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("lead_flow_states")
    .update({ status: "stopped", updated_at: new Date().toISOString() })
    .eq("prospecting_campaign_id", campaignId)
    .in("status", ["active", "waiting_dispatch", "waiting_timer", "processing"]);
  if (error) throw new Error(error.message);
}

export async function countByStatus(campaignId: string, status: LeadFlowStatus): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("lead_flow_states")
    .select("id", { count: "exact", head: true })
    .eq("prospecting_campaign_id", campaignId)
    .eq("status", status);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
