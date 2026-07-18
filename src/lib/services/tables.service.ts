/** Restaurant tables domain service. */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type TableStatus = Database["public"]["Enums"]["table_status"];
export type RestaurantTable = { id: string; name: string; status: TableStatus };

type Row = Database["public"]["Tables"]["restaurant_tables"]["Row"];
const fromRow = (r: Row): RestaurantTable => ({ id: r.id, name: r.name, status: r.status });

export async function listTables(): Promise<RestaurantTable[]> {
  const { data, error } = await supabase
    .from("restaurant_tables")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function createTable(name: string): Promise<RestaurantTable> {
  const n = name.trim();
  if (!n) throw new Error("Table name is required");
  const { data, error } = await supabase
    .from("restaurant_tables")
    .insert({ name: n } as Database["public"]["Tables"]["restaurant_tables"]["Insert"])
    .select("*")
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function renameTable(id: string, name: string): Promise<RestaurantTable> {
  const n = name.trim();
  if (!n) throw new Error("Table name is required");
  const { data, error } = await supabase
    .from("restaurant_tables")
    .update({ name: n })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteTable(id: string): Promise<void> {
  // Guard: refuse if there's an open order on this table (defensive; RLS also enforces)
  const { data: open, error: openErr } = await supabase
    .from("orders")
    .select("id")
    .eq("table_id", id)
    .eq("status", "pending")
    .eq("payment", "unpaid")
    .limit(1);
  if (openErr) throw openErr;
  if (open && open.length > 0) throw new Error("Cannot delete a table with an open order");
  const { error } = await supabase.from("restaurant_tables").delete().eq("id", id);
  if (error) throw error;
}

export async function setTableStatus(id: string, status: TableStatus): Promise<void> {
  const { error } = await supabase.from("restaurant_tables").update({ status }).eq("id", id);
  if (error) throw error;
}
