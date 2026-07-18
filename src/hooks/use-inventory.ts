/**
 * React Query hooks for the inventory module (stock, history, purchase requests,
 * purchases, expenses, waste, suppliers). Realtime-synced per business.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import * as inv from "@/lib/services/inventory.service";

export const invKeys = {
  stock: (bid: string) => ["inventory", bid, "stock"] as const,
  history: (bid: string) => ["inventory", bid, "history"] as const,
  requests: (bid: string) => ["inventory", bid, "requests"] as const,
  purchases: (bid: string) => ["inventory", bid, "purchases"] as const,
  expenses: (bid: string) => ["inventory", bid, "expenses"] as const,
  waste: (bid: string) => ["inventory", bid, "waste"] as const,
  suppliers: (bid: string) => ["inventory", bid, "suppliers"] as const,
};

function useRealtime(table: string, keys: readonly (readonly unknown[])[]) {
  const { business } = useAuth();
  const qc = useQueryClient();
  const bid = business?.id ?? "";
  useEffect(() => {
    if (!bid) return;
    const ch = supabase.channel(`${table}:${bid}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        for (const k of keys) qc.invalidateQueries({ queryKey: k });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [bid, qc, table, keys]);
}

// ─── Stock items ────────────────────────────────────────────────────────────
export function useStockItems() {
  const { business } = useAuth();
  const bid = business?.id ?? "";
  useRealtime("stock_items", [invKeys.stock(bid)]);
  return useQuery({
    queryKey: invKeys.stock(bid),
    queryFn: inv.listStockItems,
    enabled: !!bid,
    staleTime: 10_000,
  });
}

export function useCreateStockItem() {
  const { business } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inv.createStockItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: invKeys.stock(business?.id ?? "") }),
  });
}

export function useUpdateStockItem() {
  const { business } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof inv.updateStockItem>[1] }) =>
      inv.updateStockItem(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: invKeys.stock(business?.id ?? "") }),
  });
}

export function useDeleteStockItem() {
  const { business } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inv.deleteStockItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: invKeys.stock(business?.id ?? "") }),
  });
}

export function useSetStockBalance() {
  const { business } = useAuth();
  const qc = useQueryClient();
  const bid = business?.id ?? "";
  return useMutation({
    mutationFn: ({ id, newBalance, note }: { id: string; newBalance: number; note?: string }) =>
      inv.setStockBalance(id, newBalance, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invKeys.stock(bid) });
      qc.invalidateQueries({ queryKey: invKeys.history(bid) });
    },
  });
}

// ─── History ────────────────────────────────────────────────────────────────
export function useStockHistory() {
  const { business } = useAuth();
  const bid = business?.id ?? "";
  useRealtime("stock_history", [invKeys.history(bid)]);
  return useQuery({
    queryKey: invKeys.history(bid),
    queryFn: inv.listStockHistory,
    enabled: !!bid,
    staleTime: 10_000,
  });
}

// ─── Purchase requests ──────────────────────────────────────────────────────
export function usePurchaseRequests() {
  const { business } = useAuth();
  const bid = business?.id ?? "";
  useRealtime("purchase_requests", [invKeys.requests(bid)]);
  return useQuery({
    queryKey: invKeys.requests(bid),
    queryFn: inv.listPurchaseRequests,
    enabled: !!bid,
    staleTime: 10_000,
  });
}

export function useCreatePurchaseRequest() {
  const { business, profile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: Parameters<typeof inv.createPurchaseRequest>[0]) =>
      inv.createPurchaseRequest(v, profile?.name ?? "Staff"),
    onSuccess: () => qc.invalidateQueries({ queryKey: invKeys.requests(business?.id ?? "") }),
  });
}

export function useSetRequestStatus() {
  const { business } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: inv.RequestStatus }) => inv.setRequestStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: invKeys.requests(business?.id ?? "") }),
  });
}

// ─── Purchases ──────────────────────────────────────────────────────────────
export function usePurchases() {
  const { business } = useAuth();
  const bid = business?.id ?? "";
  useRealtime("purchases", [invKeys.purchases(bid), invKeys.stock(bid), invKeys.expenses(bid), invKeys.suppliers(bid)]);
  return useQuery({
    queryKey: invKeys.purchases(bid),
    queryFn: inv.listPurchases,
    enabled: !!bid,
    staleTime: 10_000,
  });
}

export function useRecordPurchase() {
  const { business } = useAuth();
  const qc = useQueryClient();
  const bid = business?.id ?? "";
  return useMutation({
    mutationFn: inv.recordPurchase,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invKeys.purchases(bid) });
      qc.invalidateQueries({ queryKey: invKeys.stock(bid) });
      qc.invalidateQueries({ queryKey: invKeys.expenses(bid) });
      qc.invalidateQueries({ queryKey: invKeys.suppliers(bid) });
      qc.invalidateQueries({ queryKey: invKeys.history(bid) });
    },
  });
}

export function useDeletePurchase() {
  const { business } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inv.deletePurchase,
    onSuccess: () => qc.invalidateQueries({ queryKey: invKeys.purchases(business?.id ?? "") }),
  });
}

// ─── Expenses ───────────────────────────────────────────────────────────────
export function useExpenses() {
  const { business } = useAuth();
  const bid = business?.id ?? "";
  useRealtime("expenses", [invKeys.expenses(bid)]);
  return useQuery({
    queryKey: invKeys.expenses(bid),
    queryFn: inv.listExpenses,
    enabled: !!bid,
    staleTime: 10_000,
  });
}

export function useCreateExpense() {
  const { business } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inv.createExpense,
    onSuccess: () => qc.invalidateQueries({ queryKey: invKeys.expenses(business?.id ?? "") }),
  });
}

export function useDeleteExpense() {
  const { business } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inv.deleteExpense,
    onSuccess: () => qc.invalidateQueries({ queryKey: invKeys.expenses(business?.id ?? "") }),
  });
}

// ─── Waste ──────────────────────────────────────────────────────────────────
export function useWaste() {
  const { business } = useAuth();
  const bid = business?.id ?? "";
  useRealtime("waste_entries", [invKeys.waste(bid), invKeys.stock(bid)]);
  return useQuery({
    queryKey: invKeys.waste(bid),
    queryFn: inv.listWaste,
    enabled: !!bid,
    staleTime: 10_000,
  });
}

export function useRecordWaste() {
  const { business } = useAuth();
  const qc = useQueryClient();
  const bid = business?.id ?? "";
  return useMutation({
    mutationFn: inv.recordWaste,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invKeys.waste(bid) });
      qc.invalidateQueries({ queryKey: invKeys.stock(bid) });
      qc.invalidateQueries({ queryKey: invKeys.history(bid) });
    },
  });
}

export function useDeleteWaste() {
  const { business } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inv.deleteWaste,
    onSuccess: () => qc.invalidateQueries({ queryKey: invKeys.waste(business?.id ?? "") }),
  });
}

// ─── Suppliers ──────────────────────────────────────────────────────────────
export function useSuppliers() {
  const { business } = useAuth();
  const bid = business?.id ?? "";
  useRealtime("suppliers", [invKeys.suppliers(bid)]);
  return useQuery({
    queryKey: invKeys.suppliers(bid),
    queryFn: inv.listSuppliers,
    enabled: !!bid,
    staleTime: 30_000,
  });
}
