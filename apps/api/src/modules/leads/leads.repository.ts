import { getSupabase } from "../../lib/supabase";

export async function findAll() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function findById(id: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return data;
}

export async function update(id: string, data: Record<string, unknown>) {
  const supabase = getSupabase();
  const { data: lead, error } = await supabase
    .from("leads")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return lead;
}

export async function createUnique(data: Record<string, unknown>) {
  const duplicate = await findDuplicate(data);
  if (duplicate) return { lead: duplicate, created: false };

  const lead = await insertWithAvailableColumns(data);
  return { lead, created: true };
}

async function findDuplicate(data: Record<string, unknown>) {
  const leads = await findAll();
  const cnpj = normalize(data.cnpj);
  const instagramUrl = normalize(data.instagram_url ?? data.instagram);
  const ifoodUrl = normalize(data.ifood_url);
  const whatsapp = onlyDigits(data.whatsapp ?? data.phone);
  const name = normalize(data.name ?? data.company_name ?? data.companyName);
  const address = normalize(data.address);

  return leads?.find((lead) => {
    const row = lead as Record<string, unknown>;
    if (cnpj && normalize(row.cnpj) === cnpj) return true;
    if (
      instagramUrl &&
      normalize(row.instagram_url ?? row.instagram) === instagramUrl
    )
      return true;
    if (ifoodUrl && normalize(row.ifood_url) === ifoodUrl) return true;
    if (whatsapp && onlyDigits(row.whatsapp ?? row.phone) === whatsapp)
      return true;

    return Boolean(
      name &&
      address &&
      normalize(row.name ?? row.company_name ?? row.companyName) === name &&
      normalize(row.address) === address,
    );
  });
}

async function insertWithAvailableColumns(payload: Record<string, unknown>) {
  const supabase = getSupabase();
  const remainingPayload = { ...payload };
  const removedColumns = new Set<string>();

  while (true) {
    const { data: lead, error } = await supabase
      .from("leads")
      .insert([remainingPayload])
      .select()
      .single();

    if (!error) return lead;

    const missingColumn = getMissingColumn(error.message);
    if (!missingColumn || removedColumns.has(missingColumn)) {
      throw new Error(error.message);
    }

    delete remainingPayload[missingColumn];
    removedColumns.add(missingColumn);
  }
}

function getMissingColumn(message: string) {
  const match = message.match(/Could not find the '([^']+)' column/);
  return match?.[1];
}

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function onlyDigits(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}
