/** React Query hooks for orders + kitchen operations, with realtime sync. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { tableKeys } from "@/hooks/use-tables";
import {
  cancelOrder,
  getOpenOrder,
  getOrder,
  listOrders,
  markOrderPaid,
  setKitchenStatus,
  upsertOrder,
  type KitchenStatus,
  type Order,
  type OrderItem,
  type PaymentMethod,
} from "@/lib/services/orders.service";

export const orderKeys = {
  all: (bid: string) => ["orders", bid] as const,
  open: (bid: string, tableId: string) => ["orders", bid, "open", tableId] as const,
  detail: (bid: string, id: string) => ["orders", bid, "detail", id] as const,
};

/** All orders for the business (paid + unpaid, recent-first). */
export function useOrders() {
  const { business } = useAuth();
  const qc = useQueryClient();
  const bid = business?.id ?? "";
  const query = useQuery({
    queryKey: orderKeys.all(bid),
    queryFn: listOrders,
    enabled: !!bid,
    staleTime: 0,           // always treat as stale so invalidation always refetches
    refetchOnWindowFocus: true,
    refetchInterval: 10_000, // 10s polling fallback if realtime drops
  });


  useEffect(() => {
    if (!bid) return;
    const channelId = crypto.randomUUID();
    const invalidate = () => qc.invalidateQueries({ queryKey: ["orders", bid] });
    const channel = supabase
      .channel(`orders:${bid}:${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "kots" }, invalidate)
      .subscribe((status) => {
        // If subscription fails to connect, schedule a fallback refetch
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          qc.invalidateQueries({ queryKey: ["orders", bid] });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [bid, qc]);

  return query;
}

export function useOpenOrder(tableId: string | undefined) {
  const { business } = useAuth();
  const bid = business?.id ?? "";
  return useQuery({
    queryKey: tableId ? orderKeys.open(bid, tableId) : ["orders", "open", "none"],
    queryFn: () => getOpenOrder(tableId!),
    enabled: !!bid && !!tableId,
    staleTime: 2_000,
  });
}

export function useOrderById(id: string | undefined) {
  const { business } = useAuth();
  const bid = business?.id ?? "";
  return useQuery({
    queryKey: id ? orderKeys.detail(bid, id) : ["orders", "detail", "none"],
    queryFn: () => getOrder(id!),
    enabled: !!bid && !!id,
  });
}

export function useUpsertOrder() {
  const { business } = useAuth();
  const qc = useQueryClient();
  const bid = business?.id ?? "";
  return useMutation({
    mutationFn: ({ tableId, items, orderType, parcelFee, orderId, notes }: { tableId: string | null; items: OrderItem[]; orderType?: "dine_in" | "takeaway"; parcelFee?: number; orderId?: string; notes?: string }) => 
      upsertOrder(tableId, items, orderType, parcelFee, orderId, notes),
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ["orders", bid] });
      if (vars.tableId) {
        qc.invalidateQueries({ queryKey: orderKeys.open(bid, vars.tableId) });
      }
      qc.invalidateQueries({ queryKey: tableKeys.all(bid) });
    },
  });
}

export function useMarkOrderPaid() {
  const { business } = useAuth();
  const qc = useQueryClient();
  const bid = business?.id ?? "";
  return useMutation({
    mutationFn: ({ orderId, method }: { orderId: string; method: PaymentMethod }) => markOrderPaid(orderId, method),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", bid] });
      qc.invalidateQueries({ queryKey: tableKeys.all(bid) });
    },
  });
}

export function useCancelOrder() {
  const { business } = useAuth();
  const qc = useQueryClient();
  const bid = business?.id ?? "";
  return useMutation({
    mutationFn: (orderId: string) => cancelOrder(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", bid] });
      qc.invalidateQueries({ queryKey: tableKeys.all(bid) });
    },
  });
}

export function useSetKitchenStatus() {
  const { business } = useAuth();
  const qc = useQueryClient();
  const bid = business?.id ?? "";
  return useMutation({
    mutationFn: ({ kotId, status }: { kotId: string; status: KitchenStatus }) => setKitchenStatus(kotId, status),
    onMutate: async ({ kotId, status }) => {
      await qc.cancelQueries({ queryKey: orderKeys.all(bid) });
      const prev = qc.getQueryData<Order[]>(orderKeys.all(bid));
      if (prev) {
        qc.setQueryData<Order[]>(
          orderKeys.all(bid),
          prev.map((o) => ({
            ...o,
            kots: o.kots.map((k) => (k.id === kotId ? { ...k, kitchenStatus: status } : k)),
          }))
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(orderKeys.all(bid), ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["orders", bid] }),
  });
}

export type KitchenTicket = import("@/lib/services/orders.service").KOT & {
  tableName: string | null;
  staffName: string;
};

/** FIFO kitchen queue: pending tickets, oldest first. */
export function useKitchenQueue() {
  const orders = useOrders();
  const queue: KitchenTicket[] = (orders.data ?? [])
    .filter((o) => o.status === "pending")
    .flatMap((o) =>
      o.kots.map((k) => ({
        ...k,
        tableName: o.tableName,
        staffName: o.staffName,
      }))
    )
    .filter((k) => k.items.length > 0 && k.kitchenStatus !== "served")
    .sort((a, b) => a.createdAt - b.createdAt);
  return { ...orders, data: queue };
}
