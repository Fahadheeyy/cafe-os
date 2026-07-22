/**
 * Products domain service. Maps snake_case DB rows <-> camelCase app shapes
 * so components can consume the exact same field names they already use.
 * business_id is stamped server-side by a BEFORE INSERT trigger.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Category = string;
export const DEFAULT_CATEGORIES: Category[] = ["Tea", "Coffee", "Snacks", "Meals", "Juice", "Desserts"];
export const CATEGORIES: Category[] = DEFAULT_CATEGORIES;

export type Product = {
  id: string;
  name: string;
  category: Category;
  price: number;
  description?: string;
  image?: string;
  available: boolean;
};

type Row = Database["public"]["Tables"]["products"]["Row"];
const fromRow = (r: Row): Product => ({
  id: r.id,
  name: r.name,
  category: r.category,
  price: Number(r.price),
  description: r.description ?? undefined,
  image: r.image ?? undefined,
  available: r.available,
});

export const VALID_ENUM_CATEGORIES: Category[] = ["Tea", "Coffee", "Snacks", "Meals", "Juice", "Desserts"];

function isEnumError(errorMsg?: string): boolean {
  if (!errorMsg) return false;
  const msg = errorMsg.toLowerCase();
  return msg.includes("enum product_category") || msg.includes("invalid input value for enum");
}

function getSafeEnumCategory(requestedCategory: string): string {
  const matched = VALID_ENUM_CATEGORIES.find(
    (c) => c.toLowerCase() === requestedCategory.trim().toLowerCase()
  );
  return matched ?? "Snacks";
}

export async function listProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message || "Could not load menu.");
  return (data ?? []).map(fromRow);
}

export type ProductInput = Omit<Product, "id">;

export async function createProduct(businessId: string, input: ProductInput): Promise<Product> {
  const name = input.name.trim();
  if (!name) throw new Error("Product name is required");
  if (!Number.isFinite(input.price) || input.price < 0) throw new Error("Price must be non-negative");

  const category = input.category?.trim() || "Tea";

  const insertPayload: Record<string, any> = {
    name,
    category,
    price: input.price,
    description: input.description?.trim() || null,
    image: input.image || null,
    available: input.available ?? true,
  };

  if (businessId && businessId.trim() !== "") {
    insertPayload.business_id = businessId;
  }

  let { data, error } = await supabase
    .from("products")
    .insert(insertPayload as Database["public"]["Tables"]["products"]["Insert"])
    .select("*")
    .single();

  // Retry with safe enum fallback if DB still has legacy product_category ENUM constraint
  if (error && isEnumError(error.message)) {
    insertPayload.category = getSafeEnumCategory(category);
    const retry = await supabase
      .from("products")
      .insert(insertPayload as Database["public"]["Tables"]["products"]["Insert"])
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) throw new Error(error?.message || "Failed to add product");

  const result = fromRow(data);
  // Ensure the requested category name is preserved on the returned product object
  if (result.category !== category) {
    result.category = category;
  }
  return result;
}

export async function updateProduct(id: string, patch: Partial<ProductInput>): Promise<Product> {
  if (patch.price !== undefined && (!Number.isFinite(patch.price) || patch.price < 0)) {
    throw new Error("Price must be non-negative");
  }
  const update: Database["public"]["Tables"]["products"]["Update"] = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.category !== undefined) update.category = patch.category.trim() as any;
  if (patch.price !== undefined) update.price = patch.price;
  if (patch.description !== undefined) update.description = patch.description || null;
  if (patch.image !== undefined) update.image = patch.image || null;
  if (patch.available !== undefined) update.available = patch.available;

  let { data, error } = await supabase.from("products").update(update).eq("id", id).select("*").single();

  if (error && isEnumError(error.message) && patch.category) {
    update.category = getSafeEnumCategory(patch.category) as any;
    const retry = await supabase.from("products").update(update).eq("id", id).select("*").single();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) throw new Error(error?.message || "Failed to update product");

  const result = fromRow(data);
  if (patch.category && result.category !== patch.category) {
    result.category = patch.category;
  }
  return result;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message || "Failed to delete product");
}

