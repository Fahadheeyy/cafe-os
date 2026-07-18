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
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!bid) return;
    const channel = supabase
      .channel(`orders:${bid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["orders", bid] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        qc.invalidateQueries({ queryKey: ["orders", bid] });
      })
      .subscribe();
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
    mutationFn: ({ tableId, items }: { tableId: string; items: OrderItem[] }) => upsertOrder(tableId, items),
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ["orders", bid] });
      qc.invalidateQueries({ queryKey: orderKeys.open(bid, vars.tableId) });
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
    mutationFn: ({ orderId, status }: { orderId: string; status: KitchenStatus }) => setKitchenStatus(orderId, status),
    onMutate: async ({ orderId, status }) => {
      await qc.cancelQueries({ queryKey: orderKeys.all(bid) });
      const prev = qc.getQueryData<Order[]>(orderKeys.all(bid));
      if (prev) {
        qc.setQueryData<Order[]>(
          orderKeys.all(bid),
          prev.map((o) => (o.id === orderId ? { ...o, kitchenStatus: status } : o)),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(orderKeys.all(bid), ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["orders", bid] }),
  });
}

/** FIFO kitchen queue: pending orders with items, oldest sent_to_kitchen_at first. */
export function useKitchenQueue() {
  const orders = useOrders();
  const queue = (orders.data ?? [])
    .filter((o) => o.status === "pending" && o.items.length > 0 && o.kitchenStatus !== "served")
    .sort((a, b) => a.sentToKitchenAt - b.sentToKitchenAt);
  return { ...orders, data: queue };
}
