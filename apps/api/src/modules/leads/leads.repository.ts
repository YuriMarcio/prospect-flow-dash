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

/** Leads que pertencem a uma campanha de prospecção (o painel do território), mais recentes primeiro. */
export async function findByProspectingCampaign(campaignId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("prospecting_campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Tira o lead da campanha (volta pro Kanban geral). Só mexe se ele for mesmo dessa campanha. */
export async function removeFromCampaign(leadId: string, campaignId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("leads")
    .update({ prospecting_campaign_id: null })
    .eq("id", leadId)
    .eq("prospecting_campaign_id", campaignId);
  if (error) throw new Error(error.message);
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

/** Mesma busca de existsByNameAndCity, mas devolve o lead (pra poder adotá-lo numa campanha). */
export async function findByNameAndCity(name: string, city: string): Promise<DuplicateLead | null> {
  const supabase = getSupabase();
  const { data: rows } = await supabase
    .from("leads")
    .select("id, name, prospecting_campaign_id")
    .ilike("name", name.trim().toLowerCase())
    .ilike("city", city.trim().toLowerCase())
    .limit(1);
  return (rows?.[0] as DuplicateLead | undefined) ?? null;
}

/** Lead que já usa esse perfil do Instagram (URL canônica), nas duas colunas em uso no banco. */
export async function findByInstagram(instagramUrl: string): Promise<DuplicateLead | null> {
  const supabase = getSupabase();
  const url = instagramUrl.trim().toLowerCase();
  if (!url) return null;

  const lookup = (column: string) =>
    Promise.resolve(
      supabase.from("leads").select("id, name, prospecting_campaign_id").ilike(column, url).limit(1),
    ).then(({ data: rows }) => (rows?.[0] as DuplicateLead | undefined) ?? null);

  const [byUrl, byInstagram] = await Promise.all([lookup("instagram_url"), lookup("instagram")]);
  return byUrl ?? byInstagram;
}

/**
 * Uma captura com campanha de destino achou um lead repetido: se ele está solto, vai pro painel
 * da campanha ("adopted"); se já está nela ("already") ou em outra ("other"), fica como está.
 */
export async function adoptDuplicate(
  duplicate: DuplicateLead,
  campaignId: string,
): Promise<"adopted" | "already" | "other"> {
  if (duplicate.prospecting_campaign_id === campaignId) return "already";
  if (duplicate.prospecting_campaign_id) return "other";
  return (await claimForCampaign(duplicate.id, campaignId)) ? "adopted" : "other";
}

/** O lead que já existe e bloqueou uma criação (id e campanha, pra decidir se dá pra adotar). */
export interface DuplicateLead {
  id: string;
  name: string | null;
  prospecting_campaign_id: string | null;
}

export type CreateUniqueResult =
  | { lead: DuplicateLead; created: false }
  | { lead: Record<string, any>; created: true };

/** Cria o lead, a não ser que já exista um igual — nesse caso devolve o existente (`created: false`). */
export async function createUnique(data: Record<string, unknown>): Promise<CreateUniqueResult> {
  const duplicate = await findDuplicate(data);
  if (duplicate) return { lead: duplicate, created: false };

  const lead = await insertWithAvailableColumns(data);
  return { lead, created: true };
}

async function findDuplicate(data: Record<string, unknown>): Promise<DuplicateLead | null> {
  const supabase = getSupabase();

  const cnpj = normalize(data.cnpj);
  const instagramUrl = normalize(data.instagram_url ?? data.instagram);
  const ifoodUrl = normalize(data.ifood_url);
  const googlePlaceId = typeof data.google_place_id === "string" ? data.google_place_id.trim() : "";
  const whatsapp = nationalDigits(data.whatsapp ?? data.phone);
  const name = normalize(data.name ?? data.company_name ?? data.companyName);
  const address = normalize(data.address);

  // Busca no banco por cada campo único separadamente (evita carregar tudo em memória).
  // A ordem abaixo é a prioridade de qual duplicado é devolvido.
  const checks: PromiseLike<DuplicateLead | null>[] = [];
  const first = (query: PromiseLike<{ data: unknown }>) =>
    Promise.resolve(query).then(({ data: rows }) => ((rows as DuplicateLead[] | null)?.[0] ?? null));
  const select = () => supabase.from("leads").select("id, name, prospecting_campaign_id");

  if (cnpj) checks.push(first(select().ilike("cnpj", cnpj).limit(1)));

  if (instagramUrl) {
    // Tenta as duas variações de coluna usadas no banco
    checks.push(first(select().ilike("instagram_url", instagramUrl).limit(1)));
    checks.push(first(select().ilike("instagram", instagramUrl).limit(1)));
  }

  if (ifoodUrl) checks.push(first(select().ilike("ifood_url", ifoodUrl).limit(1)));
  // Coluna ausente (migration não aplicada) devolve erro sem dados: `first` trata como "não achou".
  if (googlePlaceId) checks.push(first(select().eq("google_place_id", googlePlaceId).limit(1)));
  if (whatsapp) checks.push(first(select().ilike("whatsapp", `%${whatsapp}%`).limit(1)));
  if (name && address) checks.push(first(select().ilike("name", name).ilike("address", address).limit(1)));

  if (checks.length === 0) return null;

  const results = await Promise.all(checks);
  return results.find(Boolean) ?? null;
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

/**
 * Dígitos do telefone sem o código do país (55). Leads antigos foram gravados sem
 * DDI e os novos em E.164 (+55...); comparar pelo número nacional faz os dois se
 * reconhecerem como duplicados.
 */
function nationalDigits(value: unknown) {
  const digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
  return digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
}
