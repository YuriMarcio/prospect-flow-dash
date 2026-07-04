import { getSupabase } from "../../lib/supabase";

export interface BotMessageBlockRow {
  id: string;
  message_id: string;
  type: "text" | "image" | "audio";
  content: string;
  caption: string | null;
  position: number;
}

export interface BotMessageRow {
  id: string;
  prospecting_campaign_id: string;
  title: string;
  status: "active" | "draft" | "ab-test";
  ab_limit: number | null;
  ab_used_count: number;
  reply_message_id: string | null;
  created_at: string;
  bot_message_blocks: BotMessageBlockRow[];
}

const SELECT_WITH_BLOCKS = "*, bot_message_blocks(*)";

function sortBlocks(message: BotMessageRow): BotMessageRow {
  return {
    ...message,
    bot_message_blocks: [...(message.bot_message_blocks ?? [])].sort((a, b) => a.position - b.position),
  };
}

export async function findAll(campaignId: string): Promise<BotMessageRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bot_messages")
    .select(SELECT_WITH_BLOCKS)
    .eq("prospecting_campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(sortBlocks);
}

export async function findById(id: string): Promise<BotMessageRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bot_messages")
    .select(SELECT_WITH_BLOCKS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? sortBlocks(data) : null;
}

export async function findActive(campaignId: string): Promise<BotMessageRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bot_messages")
    .select(SELECT_WITH_BLOCKS)
    .eq("status", "active")
    .eq("prospecting_campaign_id", campaignId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? sortBlocks(data) : null;
}

export async function findNextAbTest(campaignId: string): Promise<BotMessageRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bot_messages")
    .select(SELECT_WITH_BLOCKS)
    .eq("status", "ab-test")
    .eq("prospecting_campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  const found = (data ?? []).find((m: BotMessageRow) => (m.ab_used_count ?? 0) < (m.ab_limit ?? 0));
  return found ? sortBlocks(found) : null;
}

async function replaceBlocks(
  messageId: string,
  blocks: Array<{ type: string; content: string; caption?: string | null }>,
): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("bot_message_blocks").delete().eq("message_id", messageId);

  if (blocks.length === 0) return;

  const rows = blocks.map((block, index) => ({
    message_id: messageId,
    type: block.type,
    content: block.content,
    caption: block.caption ?? null,
    position: index,
  }));

  const { error } = await supabase.from("bot_message_blocks").insert(rows);
  if (error) throw new Error(error.message);
}

export async function create(campaignId: string, data: Record<string, unknown>): Promise<BotMessageRow> {
  const supabase = getSupabase();
  const { blocks, ...messageData } = data as {
    blocks?: Array<{ type: string; content: string; caption?: string | null }>;
  } & Record<string, unknown>;

  // Garante que só exista 1 mensagem "active" por vez, por campanha
  if (messageData.status === "active") {
    await supabase
      .from("bot_messages")
      .update({ status: "draft" })
      .eq("status", "active")
      .eq("prospecting_campaign_id", campaignId);
  }

  const { data: message, error } = await supabase
    .from("bot_messages")
    .insert([{ ...messageData, prospecting_campaign_id: campaignId }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  await replaceBlocks(message.id, blocks ?? []);

  return (await findById(message.id))!;
}

export async function update(id: string, patch: Record<string, unknown>): Promise<BotMessageRow> {
  const supabase = getSupabase();
  const { blocks, ...messagePatch } = patch as {
    blocks?: Array<{ type: string; content: string; caption?: string | null }>;
  } & Record<string, unknown>;

  if (messagePatch.status === "active") {
    const current = await findById(id);
    if (current) {
      await supabase
        .from("bot_messages")
        .update({ status: "draft" })
        .eq("status", "active")
        .eq("prospecting_campaign_id", current.prospecting_campaign_id);
    }
  }

  if (Object.keys(messagePatch).length > 0) {
    const { error } = await supabase.from("bot_messages").update(messagePatch).eq("id", id);
    if (error) throw new Error(error.message);
  }

  if (blocks) {
    await replaceBlocks(id, blocks);
  }

  return (await findById(id))!;
}

export async function incrementAbUsedCount(id: string): Promise<void> {
  const supabase = getSupabase();
  const { data } = await supabase.from("bot_messages").select("ab_used_count").eq("id", id).single();
  await supabase
    .from("bot_messages")
    .update({ ab_used_count: (data?.ab_used_count ?? 0) + 1 })
    .eq("id", id);
}

export async function remove(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("bot_messages").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
