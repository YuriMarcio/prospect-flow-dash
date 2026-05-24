import { supabase } from "../../lib/supabase"; // Ajuste se seu client estiver em outro lugar

export async function create(data: any) {
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert([{ ...data, status: "pending" }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return campaign;
}

export async function findAll() {
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return campaigns;
}

export async function findById(id: string) {
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw new Error(error.message);
  return campaign;
}

export async function updateStatus(id: string, status: string) {
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return campaign;
}