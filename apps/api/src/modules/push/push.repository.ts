import { getSupabase } from "../../lib/supabase";

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
}

/** Código do Postgres para violação de unicidade. */
const UNIQUE_VIOLATION = "23505";

/** O `endpoint` identifica o navegador: reinscrever o mesmo endpoint só atualiza as chaves (e o dono). */
export async function upsertSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
}

export async function listByUser(userId: string): Promise<PushSubscriptionRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("push_subscriptions").select("*").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Usuários com pelo menos um dispositivo inscrito (sem repetição). */
export async function listSubscribedUserIds(): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("push_subscriptions").select("user_id");
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((row) => row.user_id as string))];
}

export async function removeByEndpoint(endpoint: string, userId?: string): Promise<void> {
  const supabase = getSupabase();
  let query = supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (userId) query = query.eq("user_id", userId);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function touchSubscriptions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = getSupabase();
  const { error } = await supabase
    .from("push_subscriptions")
    .update({ last_used_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw new Error(error.message);
}

/**
 * Reserva o envio de um lembrete. Retorna false se essa chave já foi reservada
 * (lembrete já enviado) — a unicidade da chave no banco é o que impede o duplicado,
 * inclusive entre dois processos da API rodando ao mesmo tempo.
 */
export async function claimNotification(dedupeKey: string, userId: string, kind: string): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("push_notification_log")
    .insert([{ dedupe_key: dedupeKey, user_id: userId, kind }]);
  if (!error) return true;
  if (error.code === UNIQUE_VIOLATION) return false;
  throw new Error(error.message);
}

/** Devolve a reserva quando nenhum dispositivo recebeu — o próximo ciclo tenta de novo. */
export async function releaseNotification(dedupeKey: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("push_notification_log").delete().eq("dedupe_key", dedupeKey);
  if (error) throw new Error(error.message);
}

export async function purgeNotificationLog(olderThanDays: number): Promise<void> {
  const supabase = getSupabase();
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from("push_notification_log").delete().lt("sent_at", cutoff);
  if (error) throw new Error(error.message);
}
