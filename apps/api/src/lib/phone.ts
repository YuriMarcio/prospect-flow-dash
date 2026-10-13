import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Normaliza um telefone para E.164 (+5521999990000). Aceita com ou sem DDI,
 * com máscara, espaços etc. Devolve null quando não é um número válido.
 *
 * É o formato único do sistema: o disparador manda só os dígitos para a
 * Evolution API, que precisa do código do país.
 */
export function normalizeToE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  const withDefault = parsePhoneNumberFromString(digits, "BR");
  if (withDefault?.isValid()) return withDefault.format("E.164");

  const withPlus = parsePhoneNumberFromString(`+${digits}`);
  if (withPlus?.isValid()) return withPlus.format("E.164");

  return null;
}

export type BrazilPhoneKind = "mobile" | "landline" | "other";

export interface ClassifiedPhone {
  e164: string;
  kind: BrazilPhoneKind;
}

/**
 * Normaliza e diz se o número brasileiro é celular ou fixo. Só celular (DDD + 9 + 8 dígitos)
 * é candidato a WhatsApp; o telefone fixo do Google Maps não deve ir para a fila de disparo.
 * Usa a regra do plano de numeração em vez de `getType()`, que exige a metadata "max" da lib.
 */
export function classifyBrazilPhone(raw: string): ClassifiedPhone | null {
  // normalizeToE164 descarta o "+", então um número internacional seria lido como brasileiro.
  if (/^\s*\+/.test(raw) && !/^\s*\+\s*55/.test(raw)) return null;

  const e164 = normalizeToE164(raw);
  if (!e164?.startsWith("+55")) return null;

  const national = e164.slice(3);
  if (/^\d{2}9\d{8}$/.test(national)) return { e164, kind: "mobile" };
  if (/^\d{2}[2-5]\d{7}$/.test(national)) return { e164, kind: "landline" };
  return { e164, kind: "other" };
}

/**
 * Dígitos do telefone sem o código do país (55): leads antigos foram gravados sem DDI e os
 * novos em E.164, e comparar pelo número nacional faz os dois se reconhecerem.
 */
export function nationalDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
}
