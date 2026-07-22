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

  // Postgres category column is typed product_category ENUM ('Tea', 'Coffee', 'Snacks', 'Meals', 'Juice', 'Desserts')
  const validCategory = VALID_ENUM_CATEGORIES.includes(input.category) ? input.category : "Tea";

  const insertPayload: Record<string, any> = {
    name,
    category: validCategory as any,
    price: input.price,
    description: input.description?.trim() || null,
    image: input.image || null,
    available: input.available ?? true,
  };

  if (businessId && businessId.trim() !== "") {
    insertPayload.business_id = businessId;
  }

  const { data, error } = await supabase
    .from("products")
    .insert(insertPayload as Database["public"]["Tables"]["products"]["Insert"])
    .select("*")
    .single();
  if (error) throw new Error(error.message || "Failed to add product");
  return fromRow(data);
}

export async function updateProduct(id: string, patch: Partial<ProductInput>): Promise<Product> {
  if (patch.price !== undefined && (!Number.isFinite(patch.price) || patch.price < 0)) {
    throw new Error("Price must be non-negative");
  }
  const update: Database["public"]["Tables"]["products"]["Update"] = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.category !== undefined) {
    const validCat = VALID_ENUM_CATEGORIES.includes(patch.category) ? patch.category : "Tea";
    update.category = validCat as any;
  }
  if (patch.price !== undefined) update.price = patch.price;
  if (patch.description !== undefined) update.description = patch.description || null;
  if (patch.image !== undefined) update.image = patch.image || null;
  if (patch.available !== undefined) update.available = patch.available;

  const { data, error } = await supabase.from("products").update(update).eq("id", id).select("*").single();
  if (error) throw new Error(error.message || "Failed to update product");
  return fromRow(data);
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message || "Failed to delete product");
}

