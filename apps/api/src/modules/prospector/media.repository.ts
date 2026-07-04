import { getSupabase } from "../../lib/supabase";

const BUCKET = "bot-media";

export async function uploadMedia(
  fileName: string,
  mimeType: string,
  dataBase64: string,
): Promise<string> {
  const supabase = getSupabase();
  const buffer = Buffer.from(dataBase64, "base64");
  const path = `${Date.now()}-${fileName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
