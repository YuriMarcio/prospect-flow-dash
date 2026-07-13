import { getSupabase } from "../../lib/supabase";

const ATTACHMENTS_BUCKET = "vault-attachments";

const ENTRY_LIST_FIELDS =
  "id, title, category, username, url, tags, favorite, created_at, updated_at, updated_by";
const ENTRY_DETAIL_FIELDS = `${ENTRY_LIST_FIELDS}, notes, encrypted_password`;

export interface VaultEntryInput {
  title: string;
  category?: string;
  username?: string | null;
  encryptedPassword?: string | null;
  url?: string | null;
  notes?: string | null;
  tags?: string[];
}

export async function findAllEntries(ownerUserId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vault_entries")
    .select(ENTRY_LIST_FIELDS)
    .eq("owner_user_id", ownerUserId)
    .order("title", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function findEntryById(id: string, ownerUserId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vault_entries")
    .select(ENTRY_DETAIL_FIELDS)
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createEntry(ownerUserId: string, input: VaultEntryInput) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vault_entries")
    .insert([
      {
        owner_user_id: ownerUserId,
        title: input.title,
        category: input.category ?? "Outros",
        username: input.username ?? null,
        encrypted_password: input.encryptedPassword ?? null,
        url: input.url ?? null,
        notes: input.notes ?? null,
        tags: input.tags ?? [],
        updated_by: ownerUserId,
      },
    ])
    .select(ENTRY_DETAIL_FIELDS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateEntry(
  id: string,
  ownerUserId: string,
  patch: Partial<VaultEntryInput> & { favorite?: boolean },
) {
  const supabase = getSupabase();
  const update: Record<string, unknown> = { updated_by: ownerUserId, updated_at: new Date().toISOString() };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.username !== undefined) update.username = patch.username;
  if (patch.encryptedPassword !== undefined) update.encrypted_password = patch.encryptedPassword;
  if (patch.url !== undefined) update.url = patch.url;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.tags !== undefined) update.tags = patch.tags;
  if (patch.favorite !== undefined) update.favorite = patch.favorite;

  const { data, error } = await supabase
    .from("vault_entries")
    .update(update)
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .select(ENTRY_DETAIL_FIELDS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteEntry(id: string, ownerUserId: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from("vault_entries").delete().eq("id", id).eq("owner_user_id", ownerUserId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Chaves de API
// ---------------------------------------------------------------------------

export async function listApiKeys(entryId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vault_api_keys")
    .select("id, entry_id, label, encrypted_value, created_at")
    .eq("entry_id", entryId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addApiKey(entryId: string, label: string, encryptedValue: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vault_api_keys")
    .insert([{ entry_id: entryId, label, encrypted_value: encryptedValue }])
    .select("id, entry_id, label, encrypted_value, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteApiKey(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from("vault_api_keys").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Anexos
// ---------------------------------------------------------------------------

export async function listAttachments(entryId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vault_attachments")
    .select("id, entry_id, filename, size_bytes, storage_path, created_at")
    .eq("entry_id", entryId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function findAttachmentById(id: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vault_attachments")
    .select("id, entry_id, filename, size_bytes, storage_path, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function insertAttachment(entryId: string, filename: string, sizeBytes: number, storagePath: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("vault_attachments")
    .insert([{ entry_id: entryId, filename, size_bytes: sizeBytes, storage_path: storagePath }])
    .select("id, entry_id, filename, size_bytes, storage_path, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteAttachmentRow(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from("vault_attachments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function uploadAttachmentFile(storagePath: string, buffer: Buffer, contentType: string) {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(storagePath, buffer, { contentType });
  if (error) throw new Error(error.message);
}

export async function removeAttachmentFile(storagePath: string) {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).remove([storagePath]);
  if (error) throw new Error(error.message);
}

export async function createSignedAttachmentUrl(storagePath: string, expiresInSeconds = 60): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
