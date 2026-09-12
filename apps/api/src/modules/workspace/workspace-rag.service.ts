import { embedText, embedTexts, isEmbeddingConfigured } from "../../lib/embeddings";
import * as ragRepository from "./workspace-rag.repository";
import type { MatchedChunk } from "./workspace-rag.repository";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

/** Extrai o texto "legível" de um bloco — ignora campos que não são conteúdo textual (imageUrl, fileMeta, etc). */
function blockText(block: Record<string, unknown>): string {
  if (block.type === "table" && block.table && typeof block.table === "object") {
    const table = block.table as { headers?: unknown; rows?: unknown };
    const headers = Array.isArray(table.headers) ? table.headers.join(" | ") : "";
    const rows = Array.isArray(table.rows)
      ? table.rows.map((row) => (Array.isArray(row) ? row.join(" | ") : "")).join("\n")
      : "";
    return [headers, rows].filter(Boolean).join("\n");
  }
  if (block.type === "callout") {
    const title = typeof block.title === "string" ? block.title : "";
    const content = typeof block.content === "string" ? block.content : "";
    return [title, content].filter(Boolean).join(": ");
  }
  return typeof block.content === "string" ? block.content : "";
}

function blocksToText(blocks: Record<string, unknown>[]): string {
  return blocks.map(blockText).filter(Boolean).join("\n");
}

function chunkText(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= CHUNK_SIZE) return [trimmed];

  const chunks: string[] = [];
  let start = 0;
  while (start < trimmed.length) {
    const end = Math.min(start + CHUNK_SIZE, trimmed.length);
    chunks.push(trimmed.slice(start, end));
    if (end === trimmed.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

/**
 * Reindexa os embeddings de uma página pro RAG do Workspace. Sempre
 * best-effort: uma falha aqui (sem GEMINI_API_KEY, rate limit, etc.) nunca
 * pode derrubar o salvamento da página em si — só loga e segue.
 */
export async function reindexPage(pageId: string, title: string, blocks: Record<string, unknown>[]): Promise<void> {
  if (!isEmbeddingConfigured()) return;

  try {
    const text = [title, blocksToText(blocks)].filter(Boolean).join("\n\n");
    const chunks = chunkText(text);

    if (!chunks.length) {
      await ragRepository.replaceChunks(pageId, []);
      return;
    }

    const embeddings = await embedTexts(chunks);
    await ragRepository.replaceChunks(
      pageId,
      chunks.map((content, i) => ({ content, embedding: embeddings[i] })),
    );
  } catch (error) {
    console.error(`[workspace-rag] Falha ao reindexar página ${pageId}:`, error);
  }
}

/** Busca trechos de páginas do Workspace relevantes pra uma pergunta/assunto. Nunca lança — retorna [] em falha. */
export async function searchRelevantChunks(query: string, limit = 5): Promise<MatchedChunk[]> {
  if (!isEmbeddingConfigured() || !query.trim()) return [];

  try {
    const embedding = await embedText(query);
    return await ragRepository.searchChunks(embedding, limit);
  } catch (error) {
    console.error("[workspace-rag] Falha ao buscar contexto:", error);
    return [];
  }
}
