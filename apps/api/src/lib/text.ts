const COMBINING_DIACRITICS = /[̀-ͯ]/g;

export function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .trim()
    .toLowerCase();
}
