const AUTO_REPLY_PATTERNS = [
  /fora do hor[áa]rio/i,
  /mensagem autom[áa]tica/i,
  /resposta autom[áa]tica/i,
  /no momento (estamos|n[ãa]o) /i,
  /retornaremos em breve/i,
];

const NATURAL_LANGUAGE_PATTERNS = [
  /\boi\b/i,
  /\bol[áa]\b/i,
  /\bquanto\b/i,
  /\bquero\b/i,
  /\bme passa\b/i,
  /\bvalor\b/i,
  /\bpre[çc]o\b/i,
  /\bbom dia\b/i,
  /\bboa tarde\b/i,
  /\bboa noite\b/i,
];

export interface ClassifyInput {
  elapsedMs: number;
  text: string;
  isDuplicate: boolean;
}

export type ResponseClassification = "bot" | "human" | "unclassified";

export function classifyResponse({ elapsedMs, text, isDuplicate }: ClassifyInput): ResponseClassification {
  const trimmed = text.trim();

  const looksLikeBot =
    elapsedMs < 3_000 ||
    trimmed.length > 300 ||
    isDuplicate ||
    AUTO_REPLY_PATTERNS.some((pattern) => pattern.test(trimmed));

  if (looksLikeBot) return "bot";

  const looksLikeHuman =
    elapsedMs > 30_000 &&
    trimmed.length >= 5 &&
    trimmed.length <= 200 &&
    NATURAL_LANGUAGE_PATTERNS.some((pattern) => pattern.test(trimmed));

  if (looksLikeHuman) return "human";

  return "unclassified";
}
