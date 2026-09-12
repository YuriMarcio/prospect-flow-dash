import { getGemini, isGeminiConfigured } from "./gemini";

const EMBEDDING_MODEL = "gemini-embedding-001";
// gemini-embedding-001 gera 3072 dims por padrão, mas suporta truncar via
// Matryoshka (outputDimensionality) sem perda relevante de qualidade — 768
// bate com a coluna vector(768) já criada em workspace_page_chunks.
const OUTPUT_DIMENSIONALITY = 768;

export function isEmbeddingConfigured(): boolean {
  return isGeminiConfigured();
}

export async function embedText(text: string): Promise<number[]> {
  const ai = getGemini();
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { outputDimensionality: OUTPUT_DIMENSIONALITY },
  });
  const values = response.embeddings?.[0]?.values;
  if (!values) throw new Error("Gemini não retornou embedding.");
  return values;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const ai = getGemini();
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: texts,
    config: { outputDimensionality: OUTPUT_DIMENSIONALITY },
  });
  const embeddings = response.embeddings;
  if (!embeddings || embeddings.length !== texts.length) {
    throw new Error("Gemini não retornou embeddings pra todos os textos.");
  }
  return embeddings.map((e) => {
    if (!e.values) throw new Error("Gemini retornou um embedding vazio.");
    return e.values;
  });
}
