import { getSupabase } from "../../lib/supabase";
export async function create(data: Record<string, unknown>) {
  // Gera uma string com a data e hora atual no formato brasileiro
  const timestamp = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Constrói o nome dinâmico: Ex: "Hamburgueria - São Luís - 24/05/2026 21:55"
  const dynamicName = `${data.category} - ${data.city} - ${timestamp}`;

  const payload = {
    name: dynamicName, // Nome gerado automaticamente
    category: data.category,
    city: data.city,
    quantity: data.quantity,
    status: "pending",
    processed: 0,
    found: 0,
  };

  return await insertWithAvailableColumns(payload);
}

export async function findAll() {
  const supabase = getSupabase();
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return campaigns;
}

export async function findById(id: string) {
  const supabase = getSupabase();
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return campaign;
}

export async function updateStatus(id: string, status: string) {
  const supabase = getSupabase();
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return campaign;
}

async function insertWithAvailableColumns(payload: Record<string, unknown>) {
  const supabase = getSupabase();
  const remainingPayload = { ...payload };
  const removedColumns = new Set<string>();

  while (true) {
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .insert([remainingPayload])
      .select()
      .single();

    if (!error) return campaign;

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
