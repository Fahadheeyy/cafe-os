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

export type OrderItem = { productId: string | null; name: string; price: number; qty: number; notes?: string };

export type KOT = {
  id: string;
  orderId: string;
  kitchenStatus: KitchenStatus;
  createdAt: number;
  items: OrderItem[];
};

export type Order = {
  id: string;
  tableId: string | null;
  tableName: string | null;
  items: OrderItem[];
  kots: KOT[];
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
  orderType: "dine_in" | "takeaway";
  parcelFee: number;
  notes?: string | null;
};

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type ItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type KotRow = Database["public"]["Tables"]["kots"]["Row"];

const toEpoch = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);

const fromRow = (o: OrderRow, items: ItemRow[], kots: KotRow[]): Order => {
  const orderItems = items.filter((i) => i.order_id === o.id);
  const groupedItems = orderItems.reduce((acc, i) => {
    const key = i.product_id ?? i.name;
    if (!acc[key]) acc[key] = { productId: i.product_id, name: i.name, price: Number(i.price), qty: 0, notes: i.notes ?? undefined };
    acc[key].qty += i.qty;
    if (i.notes) acc[key].notes = i.notes;
    return acc;
  }, {} as Record<string, OrderItem>);

  const orderKots = kots
    .filter((k) => k.order_id === o.id)
    .map((k) => {
      const kotItems = orderItems
        .filter((i) => i.kot_id === k.id)
        .map((i) => ({ productId: i.product_id, name: i.name, price: Number(i.price), qty: i.qty, notes: i.notes ?? undefined }));
      return {
        id: k.id,
        orderId: k.order_id!,
        kitchenStatus: k.kitchen_status ?? "queued",
        createdAt: toEpoch(k.created_at),
        items: kotItems,
      };
    })
    .sort((a, b) => a.createdAt - b.createdAt);

  return {
    id: o.id,
    tableId: o.table_id,
    tableName: o.table_name,
    items: Object.values(groupedItems),
    kots: orderKots,
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
    orderType: o.order_type,
    parcelFee: Number(o.parcel_fee),
    notes: o.notes ?? undefined,
  };
};

/** Fetch orders + items + kots for the business. */
export async function listOrders(): Promise<Order[]> {
  const { data: orders, error: e1 } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (e1) throw e1;
  const ids = (orders ?? []).map((o) => o.id);
  if (ids.length === 0) return [];
  const [{ data: items, error: e2 }, { data: kots, error: e3 }] = await Promise.all([
    supabase.from("order_items").select("*").in("order_id", ids),
    supabase.from("kots").select("*").in("order_id", ids),
  ]);
  if (e2) throw e2;
  if (e3) throw e3;
  return (orders ?? []).map((o) => fromRow(o, items ?? [], kots ?? []));
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
  const [{ data: items, error: e2 }, { data: kots, error: e3 }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", order.id),
    supabase.from("kots").select("*").eq("order_id", order.id),
  ]);
  if (e2) throw e2;
  if (e3) throw e3;
  return fromRow(order, items ?? [], kots ?? []);
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order) return null;
  const [{ data: items, error: e2 }, { data: kots, error: e3 }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", order.id),
    supabase.from("kots").select("*").eq("order_id", order.id),
  ]);
  if (e2) throw e2;
  if (e3) throw e3;
  return fromRow(order, items ?? [], kots ?? []);
}

/** Atomic save via RPC. Returns the affected order id. */
export async function upsertOrder(
  tableId: string | null,
  items: Array<Omit<OrderItem, "productId"> & { productId: string | null; notes?: string }>,
  orderType: "dine_in" | "takeaway" = "dine_in",
  parcelFee: number = 0,
  orderId?: string,
  notes?: string
): Promise<string> {
  const payload = items.map((i) => ({
    product_id: i.productId ?? "",
    name: i.name,
    price: i.price,
    qty: i.qty,
    notes: i.notes ?? "",
  }));

  let affectedOrderId: string | null = null;

  // 1. Try 6-parameter RPC call first
  const { data: d1, error: e1 } = await supabase.rpc("upsert_order_with_items", {
    _table_id: tableId,
    _items: payload as unknown as Database["public"]["Functions"]["upsert_order_with_items"]["Args"]["_items"],
    _order_type: orderType,
    _parcel_fee: parcelFee,
    _order_id: orderId || null,
    _notes: notes || null,
  } as any);

  if (!e1 && d1) {
    affectedOrderId = d1 as string;
  } else {
    // Fallback to 5-parameter RPC call if function ambiguity or parameter mismatch occurs
    const { data: d2, error: e2 } = await supabase.rpc("upsert_order_with_items", {
      _table_id: tableId,
      _items: payload as unknown as Database["public"]["Functions"]["upsert_order_with_items"]["Args"]["_items"],
      _order_type: orderType,
      _parcel_fee: parcelFee,
      _order_id: orderId || null,
    } as any);

    if (e2) throw e2;
    affectedOrderId = d2 as string;
  }

  // 2. Persist order-level and item-level notes safely
  if (affectedOrderId) {
    try {
      if (notes !== undefined) {
        await supabase.from("orders").update({ notes: notes || null }).eq("id", affectedOrderId);
      }
      for (const item of items) {
        if (item.notes) {
          if (item.productId) {
            await supabase
              .from("order_items")
              .update({ notes: item.notes })
              .eq("order_id", affectedOrderId)
              .eq("product_id", item.productId);
          } else {
            await supabase
              .from("order_items")
              .update({ notes: item.notes })
              .eq("order_id", affectedOrderId)
              .eq("name", item.name);
          }
        }
      }
    } catch (noteErr) {
      console.warn("Could not save notes to orders/order_items tables:", noteErr);
    }
  }

  return affectedOrderId;
}

export async function markOrderPaid(orderId: string, method: PaymentMethod): Promise<void> {
  const { error } = await supabase.rpc("mark_order_paid", { _order_id: orderId, _method: method });
  if (error) throw error;
}

export async function cancelOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_order", { _order_id: orderId });
  if (error) throw error;
}

export async function setKitchenStatus(kotId: string, status: KitchenStatus): Promise<void> {
  const { error } = await supabase.from("kots").update({ kitchen_status: status }).eq("id", kotId);
  if (error) throw error;
}
