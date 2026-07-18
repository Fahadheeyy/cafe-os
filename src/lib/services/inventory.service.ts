/**
 * Inventory domain services (Supabase-backed):
 * stock items + history, purchase requests, purchases + lines,
 * expenses, waste entries, suppliers.
 *
 * All DTOs use the same camelCase shape the store used to expose so
 * existing UI code keeps working with minimal changes.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// ────────────────────────────────────────────────────────────────────────────
// Enums / basic aliases
// ────────────────────────────────────────────────────────────────────────────
export type StockCategory = Database["public"]["Enums"]["stock_category"];
export type Unit = Database["public"]["Enums"]["unit_type"];
export type ExpenseCategory = Database["public"]["Enums"]["expense_category"];
export type WasteReason = Database["public"]["Enums"]["waste_reason"];
export type Priority = Database["public"]["Enums"]["priority_level"];
export type RequestStatus = Database["public"]["Enums"]["request_status"];
export type StockHistoryKind = Database["public"]["Enums"]["stock_history_kind"];

export const STOCK_CATEGORIES: StockCategory[] = ["Dairy", "Beverages", "Bakery", "Produce", "Meat", "Groceries", "Other"];
export const UNITS: Unit[] = ["L", "ml", "kg", "g", "pcs", "pack"];
export const EXPENSE_CATEGORIES: ExpenseCategory[] = ["Rent", "Electricity", "Gas", "Salary", "Maintenance", "Cleaning", "Internet", "Miscellaneous"];
export const WASTE_REASONS: WasteReason[] = ["Spillage", "Expired", "Burnt", "Damaged", "Other"];

// ────────────────────────────────────────────────────────────────────────────
// StockItem
// ────────────────────────────────────────────────────────────────────────────
export type StockItem = {
  id: string;
  name: string;
  category: StockCategory;
  currentBalance: number;
  unit: Unit;
  minimumBalance: number;
  createdAt: number;
  updatedAt: number;
};

const stockFromRow = (r: Database["public"]["Tables"]["stock_items"]["Row"]): StockItem => ({
  id: r.id, name: r.name, category: r.category,
  currentBalance: Number(r.current_balance), unit: r.unit,
  minimumBalance: Number(r.minimum_balance),
  createdAt: new Date(r.created_at).getTime(),
  updatedAt: new Date(r.updated_at).getTime(),
});

export function stockStatus(item: StockItem): "sufficient" | "low" | "critical" {
  if (item.minimumBalance <= 0) return "sufficient";
  const ratio = item.currentBalance / item.minimumBalance;
  if (ratio <= 0.3) return "critical";
  if (ratio < 1) return "low";
  return "sufficient";
}

export async function listStockItems(): Promise<StockItem[]> {
  const { data, error } = await supabase.from("stock_items").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map(stockFromRow);
}

export async function createStockItem(v: Omit<StockItem, "id" | "createdAt" | "updatedAt">) {
  const name = v.name.trim();
  if (!name) throw new Error("Stock item name is required");
  const { error } = await supabase.from("stock_items").insert({
    name, category: v.category, unit: v.unit,
    current_balance: v.currentBalance, minimum_balance: v.minimumBalance,
  } as Database["public"]["Tables"]["stock_items"]["Insert"]);
  if (error) throw error;
}

export async function updateStockItem(id: string, v: Partial<Omit<StockItem, "id" | "createdAt" | "updatedAt">>) {
  const patch: Database["public"]["Tables"]["stock_items"]["Update"] = {};
  if (v.name !== undefined) patch.name = v.name.trim();
  if (v.category !== undefined) patch.category = v.category;
  if (v.unit !== undefined) patch.unit = v.unit;
  if (v.currentBalance !== undefined) patch.current_balance = v.currentBalance;
  if (v.minimumBalance !== undefined) patch.minimum_balance = v.minimumBalance;
  const { error } = await supabase.from("stock_items").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteStockItem(id: string) {
  const { error } = await supabase.from("stock_items").delete().eq("id", id);
  if (error) throw error;
}

export async function setStockBalance(stockItemId: string, newBalance: number, note?: string) {
  const { error } = await supabase.rpc("set_stock_balance", {
    _stock_item_id: stockItemId, _new_balance: newBalance, _note: note,
  });
  if (error) throw error;
}

// ────────────────────────────────────────────────────────────────────────────
// StockHistory
// ────────────────────────────────────────────────────────────────────────────
export type StockHistory = {
  id: string;
  stockItemId: string;
  updatedById: string | null;
  updatedByName: string;
  previousBalance: number;
  newBalance: number;
  note?: string;
  timestamp: number;
  kind: StockHistoryKind;
};

export async function listStockHistory(): Promise<StockHistory[]> {
  const { data, error } = await supabase.from("stock_history")
    .select("*").order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, stockItemId: r.stock_item_id, updatedById: r.updated_by_id,
    updatedByName: r.updated_by_name, previousBalance: Number(r.previous_balance),
    newBalance: Number(r.new_balance), note: r.note ?? undefined,
    timestamp: new Date(r.created_at).getTime(), kind: r.kind,
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// PurchaseRequest
// ────────────────────────────────────────────────────────────────────────────
export type PurchaseRequest = {
  id: string;
  stockItemId: string;
  requestedQuantity: number;
  unit: Unit;
  priority: Priority;
  notes?: string;
  requestedById: string | null;
  requestedByName: string;
  status: RequestStatus;
  createdAt: number;
};

export async function listPurchaseRequests(): Promise<PurchaseRequest[]> {
  const { data, error } = await supabase.from("purchase_requests").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, stockItemId: r.stock_item_id,
    requestedQuantity: Number(r.requested_quantity),
    unit: r.unit, priority: r.priority, notes: r.notes ?? undefined,
    requestedById: r.requested_by_id, requestedByName: r.requested_by_name,
    status: r.status, createdAt: new Date(r.created_at).getTime(),
  }));
}

export async function createPurchaseRequest(v: {
  stockItemId: string; requestedQuantity: number; unit: Unit; priority: Priority; notes?: string;
}, requesterName: string) {
  if (!v.stockItemId) throw new Error("Please select a stock item");
  if (!Number.isFinite(v.requestedQuantity) || v.requestedQuantity <= 0) throw new Error("Requested quantity must be > 0");
  const { error } = await supabase.from("purchase_requests").insert({
    stock_item_id: v.stockItemId, requested_quantity: v.requestedQuantity,
    unit: v.unit, priority: v.priority, notes: v.notes ?? null,
    requested_by_name: requesterName,
  } as Database["public"]["Tables"]["purchase_requests"]["Insert"]);
  if (error) throw error;
}

export async function setRequestStatus(id: string, status: RequestStatus) {
  const { error } = await supabase.from("purchase_requests").update({ status }).eq("id", id);
  if (error) throw error;
}

// ────────────────────────────────────────────────────────────────────────────
// Purchase + PurchaseLine
// ────────────────────────────────────────────────────────────────────────────
export type PurchaseLine = { stockItemId: string | null; name: string; quantity: number; unit: Unit; rate: number; total: number };
export type Purchase = {
  id: string;
  supplier: string;
  invoiceNumber?: string;
  purchaseDate: number;
  items: PurchaseLine[];
  subtotal: number;
  tax: number;
  total: number;
  createdAt: number;
};

type PurchaseRow = Database["public"]["Tables"]["purchases"]["Row"] & {
  purchase_lines: Database["public"]["Tables"]["purchase_lines"]["Row"][];
};

export async function listPurchases(): Promise<Purchase[]> {
  const { data, error } = await supabase.from("purchases")
    .select("*, purchase_lines(*)")
    .order("purchase_date", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as PurchaseRow[]).map((r) => ({
    id: r.id, supplier: r.supplier,
    invoiceNumber: r.invoice_number ?? undefined,
    purchaseDate: new Date(r.purchase_date).getTime(),
    subtotal: Number(r.subtotal), tax: Number(r.tax), total: Number(r.total),
    createdAt: new Date(r.created_at).getTime(),
    items: (r.purchase_lines ?? []).map((l) => ({
      stockItemId: l.stock_item_id, name: l.name,
      quantity: Number(l.quantity), unit: l.unit,
      rate: Number(l.rate), total: Number(l.total),
    })),
  }));
}

export async function recordPurchase(v: {
  supplier: string; invoiceNumber?: string; purchaseDate: number; tax: number; items: PurchaseLine[];
}) {
  const { error } = await supabase.rpc("record_purchase", {
    _supplier: v.supplier,
    _invoice_number: v.invoiceNumber ?? "",
    _purchase_date: new Date(v.purchaseDate).toISOString(),
    _tax: v.tax,
    _lines: v.items.map((l) => ({
      stock_item_id: l.stockItemId, name: l.name,
      quantity: l.quantity, unit: l.unit, rate: l.rate,
    })),
  });
  if (error) throw error;
}

export async function deletePurchase(id: string) {
  const { error } = await supabase.from("purchases").delete().eq("id", id);
  if (error) throw error;
}

// ────────────────────────────────────────────────────────────────────────────
// Expense
// ────────────────────────────────────────────────────────────────────────────
export type Expense = {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  notes?: string;
  expenseDate: number;
  createdAt: number;
  purchaseId?: string;
};

export async function listExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, title: r.title, category: r.category,
    amount: Number(r.amount), notes: r.notes ?? undefined,
    expenseDate: new Date(r.expense_date).getTime(),
    createdAt: new Date(r.created_at).getTime(),
    purchaseId: r.purchase_id ?? undefined,
  }));
}

export async function createExpense(v: { title: string; category: ExpenseCategory; amount: number; notes?: string; expenseDate: number }) {
  const title = v.title.trim();
  if (!title) throw new Error("Expense title is required");
  if (!Number.isFinite(v.amount) || v.amount < 0) throw new Error("Amount must be >= 0");
  const { error } = await supabase.from("expenses").insert({
    title, category: v.category, amount: v.amount,
    notes: v.notes ?? null,
    expense_date: new Date(v.expenseDate).toISOString().slice(0, 10),
  } as Database["public"]["Tables"]["expenses"]["Insert"]);
  if (error) throw error;
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

// ────────────────────────────────────────────────────────────────────────────
// Waste
// ────────────────────────────────────────────────────────────────────────────
export type WasteEntry = {
  id: string;
  stockItemId: string;
  quantity: number;
  unit: Unit;
  reason: WasteReason;
  notes?: string;
  reportedById: string | null;
  reportedByName: string;
  estimatedCost: number;
  createdAt: number;
};

export async function listWaste(): Promise<WasteEntry[]> {
  const { data, error } = await supabase.from("waste_entries").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, stockItemId: r.stock_item_id,
    quantity: Number(r.quantity), unit: r.unit, reason: r.reason,
    notes: r.notes ?? undefined,
    reportedById: r.reported_by_id, reportedByName: r.reported_by_name,
    estimatedCost: Number(r.estimated_cost),
    createdAt: new Date(r.created_at).getTime(),
  }));
}

export async function recordWaste(v: { stockItemId: string; quantity: number; unit: Unit; reason: WasteReason; notes?: string }) {
  const { error } = await supabase.rpc("record_waste", {
    _stock_item_id: v.stockItemId, _quantity: v.quantity,
    _unit: v.unit, _reason: v.reason, _notes: v.notes,
  });
  if (error) throw error;
}

export async function deleteWaste(id: string) {
  const { error } = await supabase.from("waste_entries").delete().eq("id", id);
  if (error) throw error;
}

// ────────────────────────────────────────────────────────────────────────────
// Suppliers
// ────────────────────────────────────────────────────────────────────────────
export async function listSuppliers(): Promise<string[]> {
  const { data, error } = await supabase.from("suppliers").select("name").order("name");
  if (error) throw error;
  return (data ?? []).map((r) => r.name);
}

export async function addSupplier(name: string) {
  const n = name.trim();
  if (!n) return;
  const { error } = await supabase.from("suppliers").insert({ name: n } as Database["public"]["Tables"]["suppliers"]["Insert"]);
  if (error && !String(error.message).match(/duplicate|unique/i)) throw error;
}
