import { getSupabase } from "../../lib/supabase";
import type { BotMessageRow } from "../prospector/messages.repository";

export interface IntentResponseRow {
  id: string;
  prospecting_campaign_id: string;
  intent: string;
  message_id: string;
  personalize: boolean;
  enabled: boolean;
  created_at: string;
  bot_messages?: BotMessageRow | null;
}

const SELECT_WITH_MESSAGE = "*, bot_messages(*, bot_message_blocks(*))";

export async function findAll(campaignId: string): Promise<IntentResponseRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("intent_responses")
    .select(SELECT_WITH_MESSAGE)
    .eq("prospecting_campaign_id", campaignId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function findEnabledByIntent(
  campaignId: string,
  intent: string,
): Promise<IntentResponseRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("intent_responses")
    .select(SELECT_WITH_MESSAGE)
    .eq("prospecting_campaign_id", campaignId)
    .eq("intent", intent)
    .eq("enabled", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function upsert(
  campaignId: string,
  intent: string,
  input: { message_id: string; personalize: boolean; enabled: boolean },
): Promise<IntentResponseRow> {
  const supabase = getSupabase();
  const { error } = await supabase.from("intent_responses").upsert(
    [
      {
        prospecting_campaign_id: campaignId,
        intent,
        message_id: input.message_id,
        personalize: input.personalize,
        enabled: input.enabled,
      },
    ],
    { onConflict: "prospecting_campaign_id,intent" },
  );
  if (error) throw new Error(error.message);

  const { data, error: findError } = await supabase
    .from("intent_responses")
    .select(SELECT_WITH_MESSAGE)
    .eq("prospecting_campaign_id", campaignId)
    .eq("intent", intent)
    .single();
  if (findError) throw new Error(findError.message);
  return data;
}

export async function remove(campaignId: string, intent: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("intent_responses")
    .delete()
    .eq("prospecting_campaign_id", campaignId)
    .eq("intent", intent);
  if (error) throw new Error(error.message);
}
