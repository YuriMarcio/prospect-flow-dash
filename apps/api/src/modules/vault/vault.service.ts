import { decrypt, encrypt } from "../../lib/crypto";
import * as repo from "./vault.repository";

export interface VaultEntryPayload {
  title: string;
  category?: string;
  username?: string | null;
  password?: string | null;
  url?: string | null;
  notes?: string | null;
  tags?: string[];
}

interface EntryRow {
  id: string;
  title: string;
  category: string;
  username: string | null;
  url: string | null;
  tags: string[] | null;
  favorite: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  notes?: string | null;
  encrypted_password?: string | null;
}

function toListItem(row: EntryRow) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    username: row.username,
    url: row.url,
    tags: row.tags ?? [],
    favorite: row.favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

async function toDetail(row: EntryRow) {
  const [apiKeys, attachments] = await Promise.all([repo.listApiKeys(row.id), repo.listAttachments(row.id)]);
  return {
    ...toListItem(row),
    notes: row.notes ?? null,
    password: row.encrypted_password ? decrypt(row.encrypted_password) : null,
    apiKeys: apiKeys.map((k) => ({ id: k.id, label: k.label, value: decrypt(k.encrypted_value), createdAt: k.created_at })),
    attachments: attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      sizeBytes: a.size_bytes,
      createdAt: a.created_at,
    })),
  };
}

export async function listEntriesService(ownerUserId: string) {
  const rows = await repo.findAllEntries(ownerUserId);
  return rows.map(toListItem);
}

export async function getEntryService(id: string, ownerUserId: string) {
  const row = await repo.findEntryById(id, ownerUserId);
  if (!row) throw new Error("Entrada não encontrada.");
  return toDetail(row);
}

export async function createEntryService(ownerUserId: string, payload: VaultEntryPayload) {
  if (!payload.title?.trim()) throw new Error("Informe um título.");

  const row = await repo.createEntry(ownerUserId, {
    title: payload.title.trim(),
    category: payload.category?.trim() || undefined,
    username: payload.username?.trim() || null,
    encryptedPassword: payload.password ? encrypt(payload.password) : null,
    url: payload.url?.trim() || null,
    notes: payload.notes?.trim() || null,
    tags: payload.tags ?? [],
  });
  return toDetail(row);
}

export async function updateEntryService(
  id: string,
  ownerUserId: string,
  payload: Partial<VaultEntryPayload> & { favorite?: boolean },
) {
  const patch: Record<string, unknown> = {};
  if (payload.title !== undefined) patch.title = payload.title.trim();
  if (payload.category !== undefined) patch.category = payload.category;
  if (payload.username !== undefined) patch.username = payload.username;
  if (payload.password !== undefined) patch.encryptedPassword = payload.password ? encrypt(payload.password) : null;
  if (payload.url !== undefined) patch.url = payload.url;
  if (payload.notes !== undefined) patch.notes = payload.notes;
  if (payload.tags !== undefined) patch.tags = payload.tags;
  if (payload.favorite !== undefined) patch.favorite = payload.favorite;

  const row = await repo.updateEntry(id, ownerUserId, patch);
  return toDetail(row);
}

export async function deleteEntryService(id: string, ownerUserId: string) {
  await repo.deleteEntry(id, ownerUserId);
}

export async function toggleFavoriteService(id: string, ownerUserId: string, favorite: boolean) {
  const row = await repo.updateEntry(id, ownerUserId, { favorite });
  return toDetail(row);
}

async function assertOwnsEntry(entryId: string, ownerUserId: string) {
  const row = await repo.findEntryById(entryId, ownerUserId);
  if (!row) throw new Error("Entrada não encontrada.");
  return row;
}

export async function addApiKeyService(entryId: string, ownerUserId: string, label: string, value: string) {
  await assertOwnsEntry(entryId, ownerUserId);
  if (!label?.trim() || !value?.trim()) throw new Error("Informe rótulo e valor da chave.");
  await repo.addApiKey(entryId, label.trim(), encrypt(value));
  return getEntryService(entryId, ownerUserId);
}

export async function deleteApiKeyService(entryId: string, ownerUserId: string, keyId: string) {
  await assertOwnsEntry(entryId, ownerUserId);
  await repo.deleteApiKey(keyId);
  return getEntryService(entryId, ownerUserId);
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export async function addAttachmentService(
  entryId: string,
  ownerUserId: string,
  filename: string,
  buffer: Buffer,
  contentType: string,
) {
  await assertOwnsEntry(entryId, ownerUserId);
  if (buffer.byteLength > MAX_ATTACHMENT_BYTES) throw new Error("Arquivo maior que 10MB.");

  const storagePath = `${ownerUserId}/${entryId}/${Date.now()}-${filename}`;
  await repo.uploadAttachmentFile(storagePath, buffer, contentType);
  await repo.insertAttachment(entryId, filename, buffer.byteLength, storagePath);
  return getEntryService(entryId, ownerUserId);
}

export async function deleteAttachmentService(entryId: string, ownerUserId: string, attachmentId: string) {
  await assertOwnsEntry(entryId, ownerUserId);
  const attachment = await repo.findAttachmentById(attachmentId);
  if (!attachment || attachment.entry_id !== entryId) throw new Error("Anexo não encontrado.");

  await repo.removeAttachmentFile(attachment.storage_path);
  await repo.deleteAttachmentRow(attachmentId);
  return getEntryService(entryId, ownerUserId);
}

export async function getAttachmentDownloadUrlService(entryId: string, ownerUserId: string, attachmentId: string) {
  await assertOwnsEntry(entryId, ownerUserId);
  const attachment = await repo.findAttachmentById(attachmentId);
  if (!attachment || attachment.entry_id !== entryId) throw new Error("Anexo não encontrado.");
  const url = await repo.createSignedAttachmentUrl(attachment.storage_path);
  return { url };
}
