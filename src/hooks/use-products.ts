/** React Query hooks for the products domain. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
  type Product,
  type ProductInput,
} from "@/lib/services/products.service";

export const productKeys = {
  all: (businessId: string) => ["products", businessId] as const,
};

export function useProducts() {
  const { business } = useAuth();
  const qc = useQueryClient();
  const bid = business?.id ?? "";
  const query = useQuery({
    queryKey: productKeys.all(bid),
    queryFn: listProducts,
    enabled: !!bid,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!bid) return;
    const channel = supabase
      .channel(`products:${bid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        qc.invalidateQueries({ queryKey: productKeys.all(bid) });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bid, qc]);

  return query;
}

export function useAvailableProducts() {
  const q = useProducts();
  return { ...q, data: (q.data ?? []).filter((p) => p.available) };
}

export function useCreateProduct() {
  const { business } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProductInput) => createProduct(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all(business?.id ?? "") }),
  });
}

export function useUpdateProduct() {
  const { business } = useAuth();
  const qc = useQueryClient();
  const bid = business?.id ?? "";
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ProductInput> }) => updateProduct(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: productKeys.all(bid) });
      const prev = qc.getQueryData<Product[]>(productKeys.all(bid));
      if (prev) {
        qc.setQueryData<Product[]>(
          productKeys.all(bid),
          prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(productKeys.all(bid), ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: productKeys.all(bid) }),
  });
}

export function useDeleteProduct() {
  const { business } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: productKeys.all(business?.id ?? "") }),
  });
}
