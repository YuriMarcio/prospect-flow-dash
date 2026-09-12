import { getSupabase } from "../../lib/supabase";
import type { PageDraft, PlannerTurn, WorkspacePlanningSessionRow } from "./workspace-planning.types";

const TABLE = "workspace_planning_sessions";

export async function findActive(
  ownerUserId: string,
  channel: "web" | "whatsapp",
): Promise<WorkspacePlanningSessionRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .eq("channel", channel)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function findById(id: string): Promise<WorkspacePlanningSessionRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function create(
  ownerUserId: string,
  channel: "web" | "whatsapp",
): Promise<WorkspacePlanningSessionRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .insert([{ owner_user_id: ownerUserId, channel }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function appendTurnResult(
  id: string,
  patch: { turns: PlannerTurn[]; draft: PageDraft | null; lastAssistantMessage: string; readyToConfirm: boolean },
): Promise<WorkspacePlanningSessionRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
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
  createdPageId?: string,
): Promise<WorkspacePlanningSessionRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status, created_page_id: createdPageId ?? null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
