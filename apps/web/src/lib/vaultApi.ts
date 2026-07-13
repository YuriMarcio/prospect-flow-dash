import { request } from "@/lib/api";
import { useVaultAuthStore } from "@/store/vaultAuth";

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3333").replace(/\/$/, "");

export class VaultLockedError extends Error {}

/** Fetch dedicado às rotas /vault/* — exige o vault_token (não o cookie de sessão sozinho). */
async function vaultRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useVaultAuthStore.getState().vaultToken;
  const hasBody = init?.body != null && !(init.body instanceof FormData);

  const response = await fetch(`${API_URL}/vault${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 401) {
    useVaultAuthStore.getState().lock();
    throw new VaultLockedError("Sessão do cofre expirada.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body && typeof body.error === "string" ? body.error : null;
    throw new Error(message ?? `API respondeu com erro ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

// ---------------------------------------------------------------------------
// Verificação de identidade (TOTP)
// ---------------------------------------------------------------------------

export function getTotpStatus() {
  return request<{ enrolled: boolean }>("/vault-auth/status");
}

export function startTotpEnroll() {
  return request<{ otpauthUrl: string; manualKey: string }>("/vault-auth/totp/enroll/start", { method: "POST" });
}

export function confirmTotpEnroll(code: string) {
  return request<{ enrolled: boolean }>("/vault-auth/totp/enroll/confirm", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function verifyTotp(code: string) {
  return request<{ vaultToken: string; expiresAt: number }>("/vault-auth/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function lockVault() {
  return request<void>("/vault-auth/lock", { method: "POST" });
}

// ---------------------------------------------------------------------------
// Entradas do cofre
// ---------------------------------------------------------------------------

export interface VaultEntrySummary {
  id: string;
  title: string;
  category: string;
  username: string | null;
  url: string | null;
  tags: string[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface VaultApiKeyItem {
  id: string;
  label: string;
  value: string;
  createdAt: string;
}

export interface VaultAttachmentItem {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export interface VaultEntryDetail extends VaultEntrySummary {
  notes: string | null;
  password: string | null;
  apiKeys: VaultApiKeyItem[];
  attachments: VaultAttachmentItem[];
}

export interface VaultEntryPayload {
  title: string;
  category?: string;
  username?: string | null;
  password?: string | null;
  url?: string | null;
  notes?: string | null;
  tags?: string[];
}

export function listVaultEntries() {
  return vaultRequest<VaultEntrySummary[]>("/entries");
}

export function getVaultEntry(id: string) {
  return vaultRequest<VaultEntryDetail>(`/entries/${id}`);
}

export function createVaultEntry(payload: VaultEntryPayload) {
  return vaultRequest<VaultEntryDetail>("/entries", { method: "POST", body: JSON.stringify(payload) });
}

export function updateVaultEntry(id: string, payload: Partial<VaultEntryPayload>) {
  return vaultRequest<VaultEntryDetail>(`/entries/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function deleteVaultEntry(id: string) {
  return vaultRequest<void>(`/entries/${id}`, { method: "DELETE" });
}

export function toggleFavoriteVaultEntry(id: string, favorite: boolean) {
  return vaultRequest<VaultEntryDetail>(`/entries/${id}/favorite`, {
    method: "POST",
    body: JSON.stringify({ favorite }),
  });
}

export function addVaultApiKey(entryId: string, label: string, value: string) {
  return vaultRequest<VaultEntryDetail>(`/entries/${entryId}/api-keys`, {
    method: "POST",
    body: JSON.stringify({ label, value }),
  });
}

export function deleteVaultApiKey(entryId: string, keyId: string) {
  return vaultRequest<VaultEntryDetail>(`/entries/${entryId}/api-keys/${keyId}`, { method: "DELETE" });
}

export function uploadVaultAttachment(entryId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return vaultRequest<VaultEntryDetail>(`/entries/${entryId}/attachments`, { method: "POST", body: form });
}

export function deleteVaultAttachment(entryId: string, attachmentId: string) {
  return vaultRequest<VaultEntryDetail>(`/entries/${entryId}/attachments/${attachmentId}`, { method: "DELETE" });
}

export function getVaultAttachmentUrl(entryId: string, attachmentId: string) {
  return vaultRequest<{ url: string }>(`/entries/${entryId}/attachments/${attachmentId}`);
}
