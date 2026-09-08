import { randomUUID } from "node:crypto";
import { getSupabase } from "../../lib/supabase";

const BUCKET = "workspace-files";

export async function uploadWorkspaceFile(
  fileName: string,
  mimeType: string,
  buffer: Buffer,
): Promise<{ url: string; path: string }> {
  const supabase = getSupabase();
  const safeName = fileName.replace(/[^\w.\-]+/g, "_");
  const path = `${randomUUID()}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}
