import { getSupabase } from "../../lib/supabase";

export async function create(message: string, level: "info" | "warn" | "error" = "info"): Promise<void> {
  console.log(`[BOT] ${message}`);
  const supabase = getSupabase();
  const { error } = await supabase.from("bot_logs").insert([{ message, level }]);
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
