import { useStore } from "@/lib/store";
import { useProducts, useUpdateProduct } from "@/hooks/use-products";

export function useCategories() {
  const categories = useStore((s) => s.categories);
  const storeAddCategory = useStore((s) => s.addCategory);
  const storeUpdateCategory = useStore((s) => s.updateCategory);
  const storeDeleteCategory = useStore((s) => s.deleteCategory);

  const { data: products = [] } = useProducts();
  const updateProductMut = useUpdateProduct();

  const addCategory = (name: string) => {
    storeAddCategory(name);
  };

  const updateCategory = async (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error("Category name is required");
    if (oldName === trimmed) return;

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
