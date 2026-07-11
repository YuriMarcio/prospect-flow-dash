import { getSupabase } from "../../lib/supabase";
import { normalizeForMatch } from "../../lib/text";

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

export async function countByCampaignAndStatus(campaignId: string, status: string): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("prospecting_campaign_id", campaignId)
    .eq("status", status);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Cidades distintas dos leads, com contagem — alimenta o autocomplete do
 * filtro de campanha. Variações de grafia (acento/caixa) são agrupadas pela
 * forma normalizada; a grafia exibida é a mais frequente.
 */
export async function listDistinctCities(): Promise<Array<{ city: string; count: number }>> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("leads").select("city").not("city", "is", null);
  if (error) throw new Error(error.message);

  const groups = new Map<string, { count: number; spellings: Map<string, number> }>();
  for (const row of (data ?? []) as Array<{ city: string }>) {
    const city = row.city?.trim();
    if (!city) continue;
    const key = normalizeForMatch(city);
    const group = groups.get(key) ?? { count: 0, spellings: new Map() };
    group.count++;
    group.spellings.set(city, (group.spellings.get(city) ?? 0) + 1);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      city: [...group.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
      count: group.count,
    }))
    .sort((a, b) => b.count - a.count);
}

export async function findByWhatsapp(whatsapp: string) {
  const digits = whatsapp.replace(/\D/g, "");
  if (!digits) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .ilike("whatsapp", `%${digits}%`)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
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

export async function findProspectingCandidates(
  filters: { cities: string[]; segments: string[] },
  excludeIds: string[],
) {
  const supabase = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reassigning através de .in()/.not() faz o TS explodir a inferência de tipo do query builder
  let query: any = supabase
    .from("leads")
    .select("id, name, whatsapp, city, category")
    .eq("status", "novo")
    .is("prospecting_campaign_id", null)
    .not("whatsapp", "is", null)
    .order("created_at", { ascending: true });

  if (excludeIds.length > 0)
    query = query.not("id", "in", `(${excludeIds.join(",")})`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const candidates = data as {
    id: string;
    name: string;
    whatsapp: string;
    city: string;
    category: string;
  }[];

  // Comparação normalizada (sem distinção de maiúsculas/acentos) porque cidade/segmento são digitados livremente no filtro
  const cityFilters = filters.cities.map(normalizeForMatch);
  const segmentFilters = filters.segments.map(normalizeForMatch);

  return candidates.filter((lead) => {
    if (
      cityFilters.length > 0 &&
      !cityFilters.includes(normalizeForMatch(lead.city ?? ""))
    )
      return false;
    if (
      segmentFilters.length > 0 &&
      !segmentFilters.includes(normalizeForMatch(lead.category ?? ""))
    )
      return false;
    return true;
  });
}

/**
 * Reivindica um lead pra uma campanha, só se ele ainda não pertencer a nenhuma
 * OU já pertencer a essa mesma campanha (update condicional atômico — evita
 * corrida entre duas campanhas pegando o mesmo lead compartilhado ao mesmo
 * tempo). Sem o "ou já é dessa campanha", um lead que foi reivindicado uma
 * vez (ex.: colocado em "Hoje", depois remanejado pra um dia futuro — o que
 * apaga a linha pendente de dispatch_queue mas não libera a reivindicação)
 * fica travado pra sempre: nunca mais consegue ser reivindicado de novo pela
 * própria campanha quando o dia planejado chega. Retorna false se já estava
 * reivindicado por OUTRA campanha.
 */
export async function claimForCampaign(leadId: string, campaignId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("leads")
    .update({ prospecting_campaign_id: campaignId })
    .eq("id", leadId)
    .or(`prospecting_campaign_id.is.null,prospecting_campaign_id.eq.${campaignId}`)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** Libera de volta pro pool compartilhado todos os leads presos a uma campanha excluída. */
export async function releaseCampaign(campaignId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("leads")
    .update({ prospecting_campaign_id: null })
    .eq("prospecting_campaign_id", campaignId);
  if (error) throw new Error(error.message);
}

export async function findCampaignIdForLead(leadId: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("leads")
    .select("prospecting_campaign_id")
    .eq("id", leadId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.prospecting_campaign_id ?? null;
}

export async function existsByNameAndCity(
  name: string,
  city: string,
): Promise<boolean> {
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
      supabase
        .from("leads")
        .select("id")
        .ilike("cnpj", cnpj)
        .limit(1)
        .then(({ data: rows }) => Boolean(rows?.length)),
    );
  }

  if (instagramUrl) {
    // Tenta as duas variações de coluna usadas no banco
    checks.push(
      supabase
        .from("leads")
        .select("id")
        .ilike("instagram_url", instagramUrl)
        .limit(1)
        .then(({ data: rows }) => Boolean(rows?.length)),
    );
    checks.push(
      supabase
        .from("leads")
        .select("id")
        .ilike("instagram", instagramUrl)
        .limit(1)
        .then(({ data: rows }) => Boolean(rows?.length)),
    );
  }

  if (ifoodUrl) {
    checks.push(
      supabase
        .from("leads")
        .select("id")
        .ilike("ifood_url", ifoodUrl)
        .limit(1)
        .then(({ data: rows }) => Boolean(rows?.length)),
    );
  }

  if (whatsapp) {
    checks.push(
      supabase
        .from("leads")
        .select("id")
        .ilike("whatsapp", `%${whatsapp}%`)
        .limit(1)
        .then(({ data: rows }) => Boolean(rows?.length)),
    );
  }

  if (name && address) {
    checks.push(
      supabase
        .from("leads")
        .select("id")
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
