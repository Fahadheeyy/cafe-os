/**
 * Orders domain service. All multi-row writes go through server-side RPCs
 * so the flow is atomic and the client cannot spoof totals or business_id.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type KitchenStatus = Database["public"]["Enums"]["kitchen_status"];

export type OrderItem = { productId: string | null; name: string; price: number; qty: number };

export type Order = {
  id: string;
  tableId: string;
  tableName: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  payment: PaymentStatus;
  paymentMethod?: PaymentMethod;
  staffId: string | null;
  staffName: string;
  createdAt: number;
  updatedAt: number;
  paidAt?: number;
  kitchenStatus: KitchenStatus;
  sentToKitchenAt: number;
};

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type ItemRow = Database["public"]["Tables"]["order_items"]["Row"];

const toEpoch = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);

const fromRow = (o: OrderRow, items: ItemRow[]): Order => ({
  id: o.id,
  tableId: o.table_id,
  tableName: o.table_name,
  items: items
    .filter((i) => i.order_id === o.id)
    .map((i) => ({ productId: i.product_id, name: i.name, price: Number(i.price), qty: i.qty })),
  total: Number(o.total),
  status: o.status,
  payment: o.payment,
  paymentMethod: o.payment_method ?? undefined,
  staffId: o.staff_id,
  staffName: o.staff_name,
  createdAt: toEpoch(o.created_at),
  updatedAt: toEpoch(o.updated_at),
  paidAt: o.paid_at ? toEpoch(o.paid_at) : undefined,
  kitchenStatus: o.kitchen_status,
  sentToKitchenAt: toEpoch(o.sent_to_kitchen_at),
});

/** Fetch orders + items for the business. Two queries + local join keeps types simple. */
export async function listOrders(): Promise<Order[]> {
  const { data: orders, error: e1 } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (e1) throw e1;
  const ids = (orders ?? []).map((o) => o.id);
  if (ids.length === 0) return [];
  const { data: items, error: e2 } = await supabase.from("order_items").select("*").in("order_id", ids);
  if (e2) throw e2;
  return (orders ?? []).map((o) => fromRow(o, items ?? []));
}

export async function getOpenOrder(tableId: string): Promise<Order | null> {
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("table_id", tableId)
    .eq("status", "pending")
    .eq("payment", "unpaid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!order) return null;
  const { data: items, error: e2 } = await supabase.from("order_items").select("*").eq("order_id", order.id);
  if (e2) throw e2;
  return fromRow(order, items ?? []);
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order) return null;
  const { data: items, error: e2 } = await supabase.from("order_items").select("*").eq("order_id", order.id);
  if (e2) throw e2;
  return fromRow(order, items ?? []);
}

/** Atomic save via RPC. Returns the affected order id. */
export async function upsertOrder(tableId: string, items: Array<Omit<OrderItem, "productId"> & { productId: string | null }>): Promise<string> {
  const payload = items.map((i) => ({
    product_id: i.productId ?? "",
    name: i.name,
    price: i.price,
    qty: i.qty,
  }));
  const { data, error } = await supabase.rpc("upsert_order_with_items", {
    _table_id: tableId,
    _items: payload as unknown as Database["public"]["Functions"]["upsert_order_with_items"]["Args"]["_items"],
  });
  if (error) throw error;
  return data as string;
}

export async function markOrderPaid(orderId: string, method: PaymentMethod): Promise<void> {
  const { error } = await supabase.rpc("mark_order_paid", { _order_id: orderId, _method: method });
  if (error) throw error;
}

export async function cancelOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_order", { _order_id: orderId });
  if (error) throw error;
}

export async function setKitchenStatus(orderId: string, status: KitchenStatus): Promise<void> {
  const { error } = await supabase.from("orders").update({ kitchen_status: status }).eq("id", orderId);
  if (error) throw error;
}
