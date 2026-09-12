import { getSupabase } from "../../lib/supabase";
import type { PlannerObjectiveDraft, PlannerTurn, PlanningSessionRow } from "./objective-planning.types";

export async function findActive(
  ownerUserId: string,
  channel: "web" | "whatsapp",
): Promise<PlanningSessionRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("objective_planning_sessions")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .eq("channel", channel)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function findById(id: string): Promise<PlanningSessionRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("objective_planning_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function create(
  ownerUserId: string,
  channel: "web" | "whatsapp",
): Promise<PlanningSessionRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("objective_planning_sessions")
    .insert([{ owner_user_id: ownerUserId, channel }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function appendTurnResult(
  id: string,
  patch: {
    turns: PlannerTurn[];
    draft: PlannerObjectiveDraft[];
    lastAssistantMessage: string;
    readyToConfirm: boolean;
  },
): Promise<PlanningSessionRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("objective_planning_sessions")
    .update({
      turns: patch.turns,
      draft: patch.draft,
      last_assistant_message: patch.lastAssistantMessage,
      ready_to_confirm: patch.readyToConfirm,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function setStatus(
  id: string,
  status: "confirmed" | "cancelled",
  createdObjectiveIds?: string[],
): Promise<PlanningSessionRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("objective_planning_sessions")
    .update({
      status,
      created_objective_ids: createdObjectiveIds ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
