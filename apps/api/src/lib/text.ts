const COMBINING_DIACRITICS = /[̀-ͯ]/g;

export function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .trim()
    .toLowerCase();
}

/** Remove acentos e desfaz formas de compatibilidade ("𝐇𝐚𝐦𝐛𝐮𝐫𝐠𝐮𝐞𝐫" → "Hamburguer"), preservando a caixa. */
export function foldDiacritics(value: string): string {
  return value.normalize("NFKD").replace(COMBINING_DIACRITICS, "");
}

/** Como `normalizeForMatch`, mas também desfaz as fontes estilizadas do Instagram. */
export function normalizeLoose(value: string): string {
  return foldDiacritics(value).trim().toLowerCase();
}
