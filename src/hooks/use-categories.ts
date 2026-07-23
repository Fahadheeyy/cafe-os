import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { useProducts, useUpdateProduct } from "@/hooks/use-products";
import { DEFAULT_CATEGORIES } from "@/lib/services/products.service";

export function useCategories() {
  const storeCategories = useStore((s) => s.categories);
  const storeAddCategory = useStore((s) => s.addCategory);
  const storeUpdateCategory = useStore((s) => s.updateCategory);
  const storeDeleteCategory = useStore((s) => s.deleteCategory);

  const { data: products = [] } = useProducts();
  const updateProductMut = useUpdateProduct();

  // Dynamically compute categories list:
  // 1. Categories present in active products (from Supabase) come first so tabs with items are prominent
  // 2. Categories in store added by user
  // 3. Fallback to DEFAULT_CATEGORIES if list is empty
  const categories = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    const addCat = (c: string) => {
      const trimmed = c?.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        list.push(trimmed);
      }
    };

    // 1. Add categories from fetched products
    for (const p of products) {
      if (p.category) {
        addCat(p.category);
      }
    }

    // 2. Add categories from local store
    for (const c of storeCategories) {
      addCat(c);
    }

    // 3. Fallback to defaults if empty
    if (list.length === 0) {
      for (const c of DEFAULT_CATEGORIES) {
        addCat(c);
      }
    }

    return list;
  }, [products, storeCategories]);

  const addCategory = (name: string) => {
    const trimmed = name?.trim();
    if (!trimmed) throw new Error("Category name is required");
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error("Category already exists");
    }
    storeAddCategory(trimmed);
  };

  const updateCategory = async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error("Category name is required");
    if (oldName.toLowerCase() === trimmed.toLowerCase()) return;

    // 1. Update Zustand store
    storeUpdateCategory(oldName, trimmed);

    // 2. Also update any Supabase products assigned to oldName
    const matchingProducts = products.filter((p) => p.category === oldName);
    if (matchingProducts.length > 0) {
      await Promise.all(
        matchingProducts.map((p) =>
          updateProductMut.mutateAsync({ id: p.id, patch: { category: trimmed } }),
        ),
      );
    }
  };

  const deleteCategory = (name: string) => {
    const matchingProducts = products.filter((p) => p.category === name);
    if (matchingProducts.length > 0) {
      throw new Error(`Cannot delete "${name}" because ${matchingProducts.length} product(s) are assigned to it.`);
    }
    storeDeleteCategory(name);
  };

  return {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
  };
}

