import { getSupabase } from "../../lib/supabase";

export interface TotpSecretRow {
  user_id: string;
  encrypted_secret: string;
  confirmed_at: string | null;
}

export async function findTotpSecret(userId: string): Promise<TotpSecretRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_totp_secrets")
    .select("user_id, encrypted_secret, confirmed_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function upsertUnconfirmedSecret(userId: string, encryptedSecret: string) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("user_totp_secrets")
    .upsert({ user_id: userId, encrypted_secret: encryptedSecret, confirmed_at: null }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export async function confirmSecret(userId: string) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("user_totp_secrets")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function countRecentFailures(userId: string, sinceIso: string): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("vault_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", "otp_verify_fail")
    .gte("created_at", sinceIso);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function insertAuditLog(entry: {
  userId: string;
  action: string;
  method?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  success: boolean;
}) {
  const supabase = getSupabase();
  const { error } = await supabase.from("vault_audit_log").insert([
    {
      user_id: entry.userId,
      action: entry.action,
      method: entry.method ?? null,
      ip_address: entry.ipAddress ?? null,
      user_agent: entry.userAgent ?? null,
      success: entry.success,
    },
  ]);
  if (error) throw new Error(error.message);
}
