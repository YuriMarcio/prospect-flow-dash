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
