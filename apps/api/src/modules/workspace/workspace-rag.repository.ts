import { getSupabase } from "../../lib/supabase";

export interface MatchedChunk {
  page_id: string;
  page_title: string;
  page_icon: string;
  content: string;
  similarity: number;
}

export async function replaceChunks(
  pageId: string,
  chunks: { content: string; embedding: number[] }[],
): Promise<void> {
  const supabase = getSupabase();
  const { error: deleteError } = await supabase.from("workspace_page_chunks").delete().eq("page_id", pageId);
  if (deleteError) throw new Error(deleteError.message);
  if (!chunks.length) return;

  const rows = chunks.map((chunk, index) => ({
    page_id: pageId,
    chunk_index: index,
    content: chunk.content,
    embedding: chunk.embedding,
  }));
  const { error: insertError } = await supabase.from("workspace_page_chunks").insert(rows);
  if (insertError) throw new Error(insertError.message);
}

export async function searchChunks(queryEmbedding: number[], limit: number): Promise<MatchedChunk[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("match_workspace_chunks", {
    query_embedding: queryEmbedding,
    match_count: limit,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}
