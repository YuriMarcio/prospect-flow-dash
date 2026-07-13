import { authenticator } from "otplib";
import { decrypt, encrypt } from "../../lib/crypto";
import { getUserById } from "../auth/auth.service";
import * as repo from "./vault-auth.repository";
import { LOCKOUT_WINDOW_MINUTES, MAX_VERIFY_ATTEMPTS, TOTP_ISSUER } from "./vault-auth.constants";

// Tolerância de ±1 passo (30s) para cobrir pequena dessincronia de relógio do dispositivo.
authenticator.options = { window: 1 };

export class VaultLockedError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Muitas tentativas incorretas. Tente novamente mais tarde.");
  }
}

interface ClientMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function getTotpStatusService(userId: string) {
  const row = await repo.findTotpSecret(userId);
  return { enrolled: Boolean(row?.confirmed_at) };
}

export async function startTotpEnrollService(userId: string) {
  const user = await getUserById(userId);
  const secret = authenticator.generateSecret();
  await repo.upsertUnconfirmedSecret(userId, encrypt(secret));

  const label = user?.username || user?.email || userId;
  const otpauthUrl = authenticator.keyuri(label, TOTP_ISSUER, secret);
  const manualKey = secret.match(/.{1,4}/g)?.join("-") ?? secret;

  await repo.insertAuditLog({ userId, action: "totp_enroll_start", method: "totp", success: true });
  return { otpauthUrl, manualKey };
}

export async function confirmTotpEnrollService(userId: string, code: string) {
  const row = await repo.findTotpSecret(userId);
  if (!row) throw new Error("Nenhum cadastro de autenticador em andamento.");

  const secret = decrypt(row.encrypted_secret);
  const valid = authenticator.check(code, secret);

  await repo.insertAuditLog({ userId, action: "totp_enroll_confirm", method: "totp", success: valid });
  if (!valid) throw new Error("Código inválido.");

  await repo.confirmSecret(userId);
  return { enrolled: true };
}

async function assertNotLocked(userId: string) {
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60_000).toISOString();
  const failures = await repo.countRecentFailures(userId, since);
  if (failures >= MAX_VERIFY_ATTEMPTS) {
    throw new VaultLockedError(LOCKOUT_WINDOW_MINUTES * 60);
  }
}

export async function verifyTotpService(userId: string, code: string, meta: ClientMeta) {
  await assertNotLocked(userId);

  const row = await repo.findTotpSecret(userId);
  if (!row?.confirmed_at) {
    throw new Error("Nenhum autenticador cadastrado. Cadastre um dispositivo primeiro.");
  }

  const secret = decrypt(row.encrypted_secret);
  const valid = authenticator.check(code, secret);

  await repo.insertAuditLog({
    userId,
    action: valid ? "otp_verify_success" : "otp_verify_fail",
    method: "totp",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    success: valid,
  });

  if (!valid) throw new Error("Código incorreto.");
}

export async function lockVaultService(userId: string, meta: ClientMeta) {
  await repo.insertAuditLog({
    userId,
    action: "vault_lock_manual",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    success: true,
  });
}
