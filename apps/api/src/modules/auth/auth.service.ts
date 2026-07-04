import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { getSupabase } from "../../lib/supabase";

export interface AuthUser {
  id: string;
  username: string | null;
  email: string | null;
  name: string | null;
  phone: string | null;
}

const SELECT_FIELDS = "id, username, email, name, phone";

function toAuthUser(row: {
  id: string;
  username: string | null;
  email: string | null;
  name: string | null;
  phone: string | null;
}): AuthUser {
  return { id: row.id, username: row.username, email: row.email, name: row.name, phone: row.phone };
}

export async function listUsers(): Promise<AuthUser[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("users").select(SELECT_FIELDS);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toAuthUser);
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("users").select(SELECT_FIELDS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toAuthUser(data) : null;
}

export async function updateProfile(
  id: string,
  patch: { name?: string; phone?: string | null },
): Promise<AuthUser> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .update(patch)
    .eq("id", id)
    .select(SELECT_FIELDS)
    .single();
  if (error) throw new Error(error.message);
  return toAuthUser(data);
}

export async function verifyCredentials(username: string, password: string): Promise<AuthUser | null> {
  const supabase = getSupabase();
  const { data: user, error } = await supabase
    .from("users")
    .select(`${SELECT_FIELDS}, password_hash`)
    .eq("username", username)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!user?.password_hash) return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  return valid ? toAuthUser(user) : null;
}

let googleClient: OAuth2Client | null = null;
function getGoogleClient(): OAuth2Client {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("Configure GOOGLE_CLIENT_ID no .env para habilitar o login com Google.");
  }
  googleClient ??= new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  return googleClient;
}

export async function verifyGoogleLogin(idToken: string): Promise<AuthUser | null> {
  const client = getGoogleClient();

  let payload: { email?: string; name?: string; sub: string } | undefined;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    return null;
  }
  if (!payload?.email) return null;

  const allowedEmails = (process.env.ALLOWED_GOOGLE_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!allowedEmails.includes(payload.email.toLowerCase())) return null;

  const supabase = getSupabase();
  const { data: existing, error: findError } = await supabase
    .from("users")
    .select(SELECT_FIELDS)
    .eq("email", payload.email)
    .maybeSingle();
  if (findError) throw new Error(findError.message);

  // Mantém o nome sincronizado com a conta Google — a conta pode ter sido
  // pré-cadastrada com um nome provisório antes do primeiro login real.
  if (existing) {
    if (payload.name && payload.name !== existing.name) {
      const { data: updated, error: updateError } = await supabase
        .from("users")
        .update({ name: payload.name, google_sub: payload.sub })
        .eq("id", existing.id)
        .select(SELECT_FIELDS)
        .single();
      if (updateError) throw new Error(updateError.message);
      return toAuthUser(updated);
    }
    return toAuthUser(existing);
  }

  const { data: created, error: insertError } = await supabase
    .from("users")
    .insert([{ email: payload.email, name: payload.name ?? null, google_sub: payload.sub }])
    .select(SELECT_FIELDS)
    .single();
  if (insertError) throw new Error(insertError.message);

  return toAuthUser(created);
}
