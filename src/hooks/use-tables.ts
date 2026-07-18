/** React Query hooks for restaurant tables, with realtime sync. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  createTable,
  deleteTable,
  listTables,
  renameTable,
  setTableStatus,
  type RestaurantTable,
  type TableStatus,
} from "@/lib/services/tables.service";

export const tableKeys = {
  all: (businessId: string) => ["tables", businessId] as const,
};

export function useTables() {
  const { business } = useAuth();
  const qc = useQueryClient();
  const bid = business?.id ?? "";
  const query = useQuery({
    queryKey: tableKeys.all(bid),
    queryFn: listTables,
    enabled: !!bid,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!bid) return;
    const channel = supabase
      .channel(`tables:${bid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables" }, () => {
        qc.invalidateQueries({ queryKey: tableKeys.all(bid) });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bid, qc]);

  return query;
}

export function useTable(id: string | undefined) {
  const { data } = useTables();
  return (data ?? []).find((t) => t.id === id);
}

export function useCreateTable() {
  const { business } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createTable(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: tableKeys.all(business?.id ?? "") }),
  });
}

export function useRenameTable() {
  const { business } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameTable(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: tableKeys.all(business?.id ?? "") }),
  });
}

export function useDeleteTable() {
  const { business } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTable(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: tableKeys.all(business?.id ?? "") }),
  });
}

export function useSetTableStatus() {
  const { business } = useAuth();
  const qc = useQueryClient();
  const bid = business?.id ?? "";
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TableStatus }) => setTableStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: tableKeys.all(bid) });
      const prev = qc.getQueryData<RestaurantTable[]>(tableKeys.all(bid));
      if (prev) qc.setQueryData(tableKeys.all(bid), prev.map((t) => (t.id === id ? { ...t, status } : t)));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(tableKeys.all(bid), ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: tableKeys.all(bid) }),
  });
}
