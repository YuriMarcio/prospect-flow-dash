import { getSupabase } from "../../lib/supabase";

export async function deleteMany(ids: string[]) {
  if (ids.length === 0) return;
  const supabase = getSupabase();
  const { error } = await supabase.from("leads").delete().in("id", ids);
  if (error) throw new Error(error.message);
}

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

export async function existsByNameAndCity(name: string, city: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data: rows } = await supabase
    .from("leads")
    .select("id")
    .ilike("name", name.trim().toLowerCase())
    .ilike("city", city.trim().toLowerCase())
    .limit(1);
  return Boolean(rows?.length);
}

export async function createUnique(data: Record<string, unknown>) {
  const isDuplicate = await findDuplicate(data);
  if (isDuplicate) return { lead: null, created: false };

  const lead = await insertWithAvailableColumns(data);
  return { lead, created: true };
}

async function findDuplicate(data: Record<string, unknown>) {
  const supabase = getSupabase();

  const cnpj = normalize(data.cnpj);
  const instagramUrl = normalize(data.instagram_url ?? data.instagram);
  const ifoodUrl = normalize(data.ifood_url);
  const whatsapp = onlyDigits(data.whatsapp ?? data.phone);
  const name = normalize(data.name ?? data.company_name ?? data.companyName);
  const address = normalize(data.address);

  // Busca no banco por cada campo único separadamente (evita carregar tudo em memória)
  const checks: Promise<boolean>[] = [];

  if (cnpj) {
    checks.push(
      supabase.from("leads").select("id").ilike("cnpj", cnpj).limit(1)
        .then(({ data: rows }) => Boolean(rows?.length)),
    );
  }

  if (instagramUrl) {
    // Tenta as duas variações de coluna usadas no banco
    checks.push(
      supabase.from("leads").select("id").ilike("instagram_url", instagramUrl).limit(1)
        .then(({ data: rows }) => Boolean(rows?.length)),
    );
    checks.push(
      supabase.from("leads").select("id").ilike("instagram", instagramUrl).limit(1)
        .then(({ data: rows }) => Boolean(rows?.length)),
    );
  }

  if (ifoodUrl) {
    checks.push(
      supabase.from("leads").select("id").ilike("ifood_url", ifoodUrl).limit(1)
        .then(({ data: rows }) => Boolean(rows?.length)),
    );
  }

  if (whatsapp) {
    checks.push(
      supabase.from("leads").select("id").ilike("whatsapp", `%${whatsapp}%`).limit(1)
        .then(({ data: rows }) => Boolean(rows?.length)),
    );
  }

  if (name && address) {
    checks.push(
      supabase.from("leads").select("id")
        .ilike("name", name)
        .ilike("address", address)
        .limit(1)
        .then(({ data: rows }) => Boolean(rows?.length)),
    );
  }

  if (checks.length === 0) return null;

  const results = await Promise.all(checks);
  return results.some(Boolean) ? true : null;
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
