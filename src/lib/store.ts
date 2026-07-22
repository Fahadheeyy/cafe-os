/**
 * ============================================================================
 * CafeOS — Global Store (Zustand + localStorage persistence)
 * ============================================================================
 * Single source of truth for the entire app. Persists to `localStorage`
 * under key `cafeos-store` and migrates old snapshots forward (see
 * `version` + `migrate` at the bottom of the file).
 *
 * Layout of this file, top → bottom:
 *   1. Domain types (Role, Product, Table, Order, Stock, Purchase, …)
 *   2. Default seed data (demo users, products, tables, stock)
 *   3. Pure derived helpers (e.g. `stockStatus`)
 *   4. `useStore` — Zustand hook exposing state + actions, grouped by domain.
 *
 * All mutating actions validate input and throw `Error` with a friendly
 * message on invalid data. Callers should wrap them in `tryRun` from
 * `@/lib/notify` so failures surface as toasts instead of crashing React.
 * ============================================================================
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { computePurchaseTotals } from "@/lib/pricing";
import { money } from "@/lib/format";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/** App-wide roles. Drives auth guards + sidebar visibility. */
export type Role = "owner" | "manager" | "staff" | "chef";
export type User = { id: string; name: string; email: string; role: Role; active: boolean; password: string };

/** Menu categories shown as tabs on the POS screen. */
export type Category = string;
export const DEFAULT_CATEGORIES: string[] = ["Tea", "Coffee", "Snacks", "Meals", "Juice", "Desserts"];
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

export type TableStatus = "available" | "occupied" | "bill_ready";
export type Table = { id: string; name: string; status: TableStatus };

export type OrderItem = { productId: string; name: string; price: number; qty: number };
export type OrderStatus = "pending" | "completed" | "cancelled";
export type PaymentStatus = "unpaid" | "paid";
export type PaymentMethod = "upi" | "cash";
/** Kitchen ticket lifecycle. Independent of payment status. */
export type KitchenStatus = "queued" | "preparing" | "ready" | "served";
export type Order = {
  id: string;
  tableId: string;
  tableName: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  payment: PaymentStatus;
  paymentMethod?: PaymentMethod;
  staffId: string;
  staffName: string;
  createdAt: number;
  paidAt?: number;
  /** Kitchen ticket state. Defaults to "queued" when order is created. */
  kitchenStatus: KitchenStatus;
  /** Epoch ms — first sent to kitchen (drives FIFO ordering). */
  sentToKitchenAt: number;
  /** Epoch ms — bumped on every item change so chef sees fresh tickets. */
  updatedAt: number;
};


export type Settings = { restaurantName: string; logo?: string; currency: string; taxPercent: number; parcelFee: number; };

// Inventory
export type StockCategory = "Dairy" | "Beverages" | "Bakery" | "Produce" | "Meat" | "Groceries" | "Other";
export const STOCK_CATEGORIES: StockCategory[] = ["Dairy", "Beverages", "Bakery", "Produce", "Meat", "Groceries", "Other"];
export type Unit = "L" | "ml" | "kg" | "g" | "pcs" | "pack";
export const UNITS: Unit[] = ["L", "ml", "kg", "g", "pcs", "pack"];

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

export type StockHistory = {
  id: string;
  stockItemId: string;
  updatedById: string;
  updatedByName: string;
  previousBalance: number;
  newBalance: number;
  note?: string;
  timestamp: number;
  kind: "update" | "purchase" | "waste";
};

export type Priority = "low" | "medium" | "high";
export type RequestStatus = "pending" | "approved" | "purchased" | "rejected";
export type PurchaseRequest = {
  id: string;
  stockItemId: string;
  requestedQuantity: number;
  unit: Unit;
  priority: Priority;
  notes?: string;
  requestedById: string;
  requestedByName: string;
  status: RequestStatus;
  createdAt: number;
};

export type PurchaseLine = { stockItemId: string; name: string; quantity: number; unit: Unit; rate: number; total: number };
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

export type ExpenseCategory = "Rent" | "Electricity" | "Gas" | "Salary" | "Maintenance" | "Cleaning" | "Internet" | "Purchases" | "Miscellaneous";
export const EXPENSE_CATEGORIES: ExpenseCategory[] = ["Rent", "Electricity", "Gas", "Salary", "Maintenance", "Cleaning", "Internet", "Miscellaneous"];
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

export type WasteReason = "Spillage" | "Expired" | "Burnt" | "Damaged" | "Other";
export const WASTE_REASONS: WasteReason[] = ["Spillage", "Expired", "Burnt", "Damaged", "Other"];
export type WasteEntry = {
  id: string;
  stockItemId: string;
  quantity: number;
  unit: Unit;
  reason: WasteReason;
  notes?: string;
  reportedById: string;
  reportedByName: string;
  estimatedCost: number;
  createdAt: number;
};

type State = {
  currentUserId: string | null;
  users: User[];
  products: Product[];
  tables: Table[];
  orders: Order[];
  settings: Settings;
  stockItems: StockItem[];
  stockHistory: StockHistory[];
  purchaseRequests: PurchaseRequest[];
  purchases: Purchase[];
  expenses: Expense[];
  waste: WasteEntry[];
  categories: string[];
  suppliers: string[];
  // auth
  login: (email: string, password: string) => User | null;
  logout: () => void;
  addStaff: (name: string, email: string, password: string, role?: Role) => void;
  removeUser: (id: string) => void;
  toggleUserActive: (id: string) => void;
  resetPassword: (id: string, pw: string) => void;
  // categories
  addCategory: (name: string) => void;
  updateCategory: (oldName: string, newName: string) => void;
  deleteCategory: (name: string) => void;
  // products
  addProduct: (p: Omit<Product, "id">) => void;
  updateProduct: (id: string, p: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  // tables
  addTable: (name: string) => void;
  renameTable: (id: string, name: string) => void;
  deleteTable: (id: string) => void;
  setTableStatus: (id: string, s: TableStatus) => void;
  // orders
  getOpenOrder: (tableId: string) => Order | undefined;
  upsertOrder: (tableId: string, items: OrderItem[]) => Order;
  markOrderPaid: (orderId: string, method?: PaymentMethod) => void;
  cancelOrder: (orderId: string) => void;
  setKitchenStatus: (orderId: string, s: KitchenStatus) => void;
  updateSettings: (s: Partial<Settings>) => void;
  // stock
  addStockItem: (p: Omit<StockItem, "id" | "createdAt" | "updatedAt">) => void;
  updateStockItem: (id: string, p: Partial<StockItem>) => void;
  deleteStockItem: (id: string) => void;
  setStockBalance: (id: string, newBalance: number, note?: string) => void;
  // requests
  createPurchaseRequest: (p: Omit<PurchaseRequest, "id" | "createdAt" | "requestedById" | "requestedByName" | "status">) => void;
  setRequestStatus: (id: string, status: RequestStatus) => void;
  // purchases
  recordPurchase: (p: Omit<Purchase, "id" | "createdAt" | "subtotal" | "total"> & { tax: number }) => void;
  deletePurchase: (id: string) => void;
  // expenses
  addExpense: (p: Omit<Expense, "id" | "createdAt">) => void;
  deleteExpense: (id: string) => void;
  // waste
  addWaste: (p: Omit<WasteEntry, "id" | "createdAt" | "reportedById" | "reportedByName" | "estimatedCost">) => void;
  deleteWaste: (id: string) => void;
  // suppliers
  addSupplier: (s: string) => void;
};

const uid = () => Math.random().toString(36).slice(2, 10);

const defaultProducts: Product[] = [
  { id: uid(), name: "Masala Chai", category: "Tea", price: 40, available: true },
  { id: uid(), name: "Green Tea", category: "Tea", price: 60, available: true },
  { id: uid(), name: "Lemon Tea", category: "Tea", price: 50, available: true },
  { id: uid(), name: "Espresso", category: "Coffee", price: 90, available: true },
  { id: uid(), name: "Cappuccino", category: "Coffee", price: 140, available: true },
  { id: uid(), name: "Latte", category: "Coffee", price: 150, available: true },
  { id: uid(), name: "Cold Brew", category: "Coffee", price: 180, available: true },
  { id: uid(), name: "Samosa", category: "Snacks", price: 30, available: true },
  { id: uid(), name: "Veg Sandwich", category: "Snacks", price: 120, available: true },
  { id: uid(), name: "French Fries", category: "Snacks", price: 130, available: true },
  { id: uid(), name: "Paneer Wrap", category: "Meals", price: 220, available: true },
  { id: uid(), name: "Pasta Alfredo", category: "Meals", price: 280, available: true },
  { id: uid(), name: "Orange Juice", category: "Juice", price: 110, available: true },
  { id: uid(), name: "Watermelon Juice", category: "Juice", price: 100, available: true },
  { id: uid(), name: "Chocolate Brownie", category: "Desserts", price: 150, available: true },
  { id: uid(), name: "Cheesecake", category: "Desserts", price: 190, available: true },
];

const defaultTables: Table[] = Array.from({ length: 8 }, (_, i) => ({
  id: uid(),
  name: `Table ${i + 1}`,
  status: "available" as TableStatus,
}));

const defaultUsers: User[] = [
  { id: "owner-1", name: "Owner", email: "owner@cafe.com", role: "owner", active: true, password: "owner123" },
  { id: "manager-1", name: "Priya", email: "manager@cafe.com", role: "manager", active: true, password: "manager123" },
  { id: "staff-1", name: "Alex", email: "staff@cafe.com", role: "staff", active: true, password: "staff123" },
  { id: "chef-1", name: "Ravi", email: "chef@cafe.com", role: "chef", active: true, password: "chef123" },
];

const now = Date.now();
const defaultStock: StockItem[] = [
  { id: "stk-milk", name: "Milk", category: "Dairy", currentBalance: 8, unit: "L", minimumBalance: 10, createdAt: now, updatedAt: now },
  { id: "stk-tea", name: "Tea Powder", category: "Beverages", currentBalance: 700, unit: "g", minimumBalance: 1000, createdAt: now, updatedAt: now },
  { id: "stk-coffee", name: "Coffee Beans", category: "Beverages", currentBalance: 2.5, unit: "kg", minimumBalance: 2, createdAt: now, updatedAt: now },
  { id: "stk-sugar", name: "Sugar", category: "Groceries", currentBalance: 4, unit: "kg", minimumBalance: 3, createdAt: now, updatedAt: now },
  { id: "stk-bread", name: "Bread Loaves", category: "Bakery", currentBalance: 6, unit: "pcs", minimumBalance: 15, createdAt: now, updatedAt: now },
  { id: "stk-chicken", name: "Chicken", category: "Meat", currentBalance: 1, unit: "kg", minimumBalance: 5, createdAt: now, updatedAt: now },
  { id: "stk-tomato", name: "Tomatoes", category: "Produce", currentBalance: 3, unit: "kg", minimumBalance: 2, createdAt: now, updatedAt: now },
];

/**
 * Traffic-light health for a stock item.
 * - `critical`  → balance ≤ 30 % of the minimum
 * - `low`       → balance below the minimum but above the critical threshold
 * - `sufficient`→ balance at or above the minimum (or no minimum configured)
 */
export function stockStatus(item: StockItem): "sufficient" | "low" | "critical" {
  if (item.minimumBalance <= 0) return "sufficient";
  const ratio = item.currentBalance / item.minimumBalance;
  if (ratio <= 0.3) return "critical";
  if (ratio < 1) return "low";
  return "sufficient";
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      currentUserId: null,
      users: defaultUsers,
      products: defaultProducts,
      tables: defaultTables,
      orders: [],
      settings: { restaurantName: "CafeOS", currency: "₹", taxPercent: 5, parcelFee: 0 },
      stockItems: defaultStock,
      stockHistory: [],
      purchaseRequests: [],
      purchases: [],
      expenses: [],
      waste: [],
      categories: DEFAULT_CATEGORIES,
      suppliers: ["Fresh Dairy Co.", "Metro Wholesale", "Green Farms"],

      login: (email, password) => {
        const u = get().users.find(
          (x) => x.email.toLowerCase() === email.toLowerCase() && x.password === password && x.active,
        );
        if (u) set({ currentUserId: u.id });
        return u ?? null;
      },
      logout: () => set({ currentUserId: null }),

      addStaff: (name, email, password, role = "staff") => {
        const n = name?.trim();
        const e = email?.trim().toLowerCase();
        if (!n) throw new Error("Name is required");
        if (!e || !/^\S+@\S+\.\S+$/.test(e)) throw new Error("Enter a valid email");
        if (!password || password.length < 4) throw new Error("Password must be at least 4 characters");
        const state = get();
        if (state.users.some((u) => u.email.toLowerCase() === e)) {
          throw new Error("A user with this email already exists");
        }
        set((s) => ({ users: [...s.users, { id: uid(), name: n, email: e, password, role, active: true }] }));
      },
      removeUser: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id) })),
      toggleUserActive: (id) =>
        set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, active: !u.active } : u)) })),
      resetPassword: (id, pw) => {
        if (!pw || pw.length < 4) throw new Error("Password must be at least 4 characters");
        set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, password: pw } : u)) }));
      },

      addCategory: (name) => {
        const n = name?.trim();
        if (!n) throw new Error("Category name is required");
        const state = get();
        if (state.categories.some((c) => c.toLowerCase() === n.toLowerCase())) {
          throw new Error("Category already exists");
        }
        set((s) => ({ categories: [...s.categories, n] }));
      },
      updateCategory: (oldName, newName) => {
        const n = newName?.trim();
        if (!n) throw new Error("Category name is required");
        const state = get();
        if (state.categories.some((c) => c.toLowerCase() === n.toLowerCase() && c !== oldName)) {
          throw new Error("A category with this name already exists");
        }
        set((s) => ({
          categories: s.categories.map((c) => (c === oldName ? n : c)),
          products: s.products.map((p) => (p.category === oldName ? { ...p, category: n } : p)),
        }));
      },
      deleteCategory: (name) => {
        const state = get();
        if (state.categories.length <= 1) throw new Error("At least one category must remain");
        set((s) => ({ categories: s.categories.filter((c) => c !== name) }));
      },

      addProduct: (p) => {
        if (!p.name?.trim()) throw new Error("Product name is required");
        if (!Number.isFinite(p.price) || p.price < 0) throw new Error("Price must be a non-negative number");
        set((s) => ({ products: [{ id: uid(), ...p, name: p.name.trim() }, ...s.products] }));
      },
      updateProduct: (id, p) => {
        if (p.price !== undefined && (!Number.isFinite(p.price) || p.price < 0)) {
          throw new Error("Price must be a non-negative number");
        }
        set((s) => ({ products: s.products.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
      },
      deleteProduct: (id) => set((s) => ({ products: s.products.filter((x) => x.id !== id) })),

      addTable: (name) => {
        const n = name?.trim();
        if (!n) throw new Error("Table name is required");
        set((s) => ({ tables: [...s.tables, { id: uid(), name: n, status: "available" }] }));
      },
      renameTable: (id, name) => {
        const n = name?.trim();
        if (!n) throw new Error("Table name is required");
        set((s) => ({ tables: s.tables.map((t) => (t.id === id ? { ...t, name: n } : t)) }));
      },
      deleteTable: (id) => {
        const state = get();
        const hasOpen = state.orders.some(
          (o) => o.tableId === id && o.status === "pending" && o.payment === "unpaid",
        );
        if (hasOpen) throw new Error("Cannot delete a table with an open order");
        set((s) => ({ tables: s.tables.filter((t) => t.id !== id) }));
      },
      setTableStatus: (id, status) => set((s) => ({ tables: s.tables.map((t) => (t.id === id ? { ...t, status } : t)) })),

      getOpenOrder: (tableId) =>
        get().orders.find((o) => o.tableId === tableId && o.status === "pending" && o.payment === "unpaid"),

      upsertOrder: (tableId, items) => {
        const state = get();
        const table = state.tables.find((t) => t.id === tableId)!;
        const user = state.users.find((u) => u.id === state.currentUserId)!;
        const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
        const existing = state.orders.find(
          (o) => o.tableId === tableId && o.status === "pending" && o.payment === "unpaid",
        );
        const nowTs = Date.now();
        if (existing) {
          // Any new items? Re-queue to kitchen if the ticket had already been served.
          const wasServed = existing.kitchenStatus === "served";
          const updated: Order = {
            ...existing,
            items,
            total,
            tableName: table.name,
            updatedAt: nowTs,
            kitchenStatus: wasServed && items.length ? "queued" : existing.kitchenStatus,
            sentToKitchenAt: wasServed && items.length ? nowTs : existing.sentToKitchenAt,
          };
          set((s) => ({
            orders: s.orders.map((o) => (o.id === existing.id ? updated : o)),
            tables: s.tables.map((t) => (t.id === tableId ? { ...t, status: items.length ? "occupied" : "available" } : t)),
          }));
          return updated;
        }
        const order: Order = {
          id: uid(), tableId, tableName: table.name, items, total,
          status: "pending", payment: "unpaid",
          staffId: user?.id ?? "", staffName: user?.name ?? "Staff",
          createdAt: nowTs, updatedAt: nowTs,
          kitchenStatus: "queued", sentToKitchenAt: nowTs,
        };
        set((s) => ({
          orders: [order, ...s.orders],
          tables: s.tables.map((t) => (t.id === tableId ? { ...t, status: "occupied" } : t)),
        }));
        return order;
      },

      markOrderPaid: (orderId, method = "cash") =>
        set((s) => {
          const order = s.orders.find((o) => o.id === orderId);
          if (!order) return s;
          return {
            orders: s.orders.map((o) => (o.id === orderId ? { ...o, payment: "paid", paymentMethod: method, status: "completed", paidAt: Date.now(), kitchenStatus: "served" as KitchenStatus } : o)),
            tables: s.tables.map((t) => (t.id === order.tableId ? { ...t, status: "available" } : t)),
          };
        }),

      cancelOrder: (orderId) =>
        set((s) => {
          const order = s.orders.find((o) => o.id === orderId);
          if (!order) return s;
          return {
            orders: s.orders.map((o) => (o.id === orderId ? { ...o, status: "cancelled", kitchenStatus: "served" as KitchenStatus } : o)),
            tables: s.tables.map((t) => (t.id === order.tableId ? { ...t, status: "available" } : t)),
          };
        }),

      setKitchenStatus: (orderId, ks) =>
        set((s) => ({
          orders: s.orders.map((o) => (o.id === orderId ? { ...o, kitchenStatus: ks, updatedAt: Date.now() } : o)),
        })),



      updateSettings: (s) => set((st) => ({ settings: { ...st.settings, ...s } })),

      // ============ stock ============
      addStockItem: (p) => {
        if (!p.name?.trim()) throw new Error("Stock item name is required");
        if (!Number.isFinite(p.currentBalance) || p.currentBalance < 0) throw new Error("Current balance must be ≥ 0");
        if (!Number.isFinite(p.minimumBalance) || p.minimumBalance < 0) throw new Error("Minimum balance must be ≥ 0");
        set((s) => ({
          stockItems: [...s.stockItems, { id: uid(), createdAt: Date.now(), updatedAt: Date.now(), ...p, name: p.name.trim() }],
        }));
      },
      updateStockItem: (id, p) => {
        if (p.currentBalance !== undefined && (!Number.isFinite(p.currentBalance) || p.currentBalance < 0)) {
          throw new Error("Current balance must be ≥ 0");
        }
        if (p.minimumBalance !== undefined && (!Number.isFinite(p.minimumBalance) || p.minimumBalance < 0)) {
          throw new Error("Minimum balance must be ≥ 0");
        }
        set((s) => ({
          stockItems: s.stockItems.map((x) => (x.id === id ? { ...x, ...p, updatedAt: Date.now() } : x)),
        }));
      },
      deleteStockItem: (id) => set((s) => ({ stockItems: s.stockItems.filter((x) => x.id !== id) })),
      setStockBalance: (id, newBalance, note) => {
        if (!Number.isFinite(newBalance) || newBalance < 0) throw new Error("New balance must be ≥ 0");
        const state = get();
        const item = state.stockItems.find((x) => x.id === id);
        if (!item) throw new Error("Stock item not found");
        set((s) => {
          const user = s.users.find((u) => u.id === s.currentUserId);
          const hist: StockHistory = {
            id: uid(), stockItemId: id, updatedById: user?.id ?? "",
            updatedByName: user?.name ?? "System",
            previousBalance: item.currentBalance, newBalance, note,
            timestamp: Date.now(), kind: "update",
          };
          return {
            stockItems: s.stockItems.map((x) => (x.id === id ? { ...x, currentBalance: newBalance, updatedAt: Date.now() } : x)),
            stockHistory: [hist, ...s.stockHistory],
          };
        });
      },

      // ============ requests ============
      createPurchaseRequest: (p) => {
        if (!p.stockItemId) throw new Error("Please select a stock item");
        if (!Number.isFinite(p.requestedQuantity) || p.requestedQuantity <= 0) {
          throw new Error("Requested quantity must be greater than 0");
        }
        set((s) => {
          const user = s.users.find((u) => u.id === s.currentUserId);
          return {
            purchaseRequests: [
              {
                id: uid(), createdAt: Date.now(), status: "pending",
                requestedById: user?.id ?? "", requestedByName: user?.name ?? "Chef",
                ...p,
              },
              ...s.purchaseRequests,
            ],
          };
        });
      },
      setRequestStatus: (id, status) =>
        set((s) => ({ purchaseRequests: s.purchaseRequests.map((r) => (r.id === id ? { ...r, status } : r)) })),

      // ============ purchases ============
      recordPurchase: (p) => {
        if (!p.supplier?.trim()) throw new Error("Supplier is required");
        if (!p.items?.length) throw new Error("Add at least one line item");
        for (const line of p.items) {
          if (!line.stockItemId) throw new Error("Every line needs a stock item");
          if (!Number.isFinite(line.quantity) || line.quantity <= 0) throw new Error(`Quantity for ${line.name || "item"} must be > 0`);
          if (!Number.isFinite(line.rate) || line.rate < 0) throw new Error(`Rate for ${line.name || "item"} must be ≥ 0`);
        }
        set((s) => {
          const { subtotal, total } = computePurchaseTotals(p.items, p.tax || 0);
          const id = uid();
          const purchase: Purchase = { id, createdAt: Date.now(), subtotal, total, ...p };
          const user = s.users.find((u) => u.id === s.currentUserId);
          const stockItems = s.stockItems.map((it) => {
            const line = p.items.find((l) => l.stockItemId === it.id);
            return line ? { ...it, currentBalance: it.currentBalance + line.quantity, updatedAt: Date.now() } : it;
          });
          const newHistory: StockHistory[] = p.items.map((l) => {
            const it = s.stockItems.find((x) => x.id === l.stockItemId)!;
            return {
              id: uid(), stockItemId: l.stockItemId,
              updatedById: user?.id ?? "", updatedByName: user?.name ?? "Owner",
              previousBalance: it.currentBalance, newBalance: it.currentBalance + l.quantity,
              note: `Purchase from ${p.supplier}`, timestamp: Date.now(), kind: "purchase",
            };
          });
          const expense: Expense = {
            id: uid(), title: `Purchase: ${p.supplier}`, category: "Purchases" as ExpenseCategory,
            amount: total, expenseDate: p.purchaseDate, createdAt: Date.now(), purchaseId: id,
            notes: p.invoiceNumber ? `Invoice ${p.invoiceNumber}` : undefined,
          };
          return {
            purchases: [purchase, ...s.purchases],
            stockItems,
            stockHistory: [...newHistory, ...s.stockHistory],
            expenses: [expense, ...s.expenses],
            suppliers: s.suppliers.includes(p.supplier) ? s.suppliers : [...s.suppliers, p.supplier],
          };
        });
      },
      deletePurchase: (id) =>
        set((s) => ({
          purchases: s.purchases.filter((p) => p.id !== id),
          expenses: s.expenses.filter((e) => e.purchaseId !== id),
        })),

      // ============ expenses ============
      addExpense: (p) => {
        if (!p.title?.trim()) throw new Error("Expense title is required");
        if (!Number.isFinite(p.amount) || p.amount < 0) throw new Error("Amount must be ≥ 0");
        set((s) => ({ expenses: [{ id: uid(), createdAt: Date.now(), ...p, title: p.title.trim() }, ...s.expenses] }));
      },
      deleteExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),

      // ============ waste ============
      addWaste: (p) => {
        if (!p.stockItemId) throw new Error("Please select a stock item");
        if (!Number.isFinite(p.quantity) || p.quantity <= 0) throw new Error("Quantity must be > 0");
        const state = get();
        const item = state.stockItems.find((x) => x.id === p.stockItemId);
        if (!item) throw new Error("Stock item not found");
        set((s) => {
          const user = s.users.find((u) => u.id === s.currentUserId);
          const lastPurchaseLine = s.purchases
            .flatMap((pu) => pu.items)
            .reverse()
            .find((l) => l.stockItemId === p.stockItemId);
          const rate = lastPurchaseLine?.rate ?? 0;
          const estimatedCost = rate * p.quantity;
          const entry: WasteEntry = {
            id: uid(), createdAt: Date.now(),
            reportedById: user?.id ?? "", reportedByName: user?.name ?? "Chef",
            estimatedCost, ...p,
          };
          const newBalance = Math.max(0, item.currentBalance - p.quantity);
          const hist: StockHistory = {
            id: uid(), stockItemId: item.id,
            updatedById: user?.id ?? "", updatedByName: user?.name ?? "Chef",
            previousBalance: item.currentBalance, newBalance,
            note: `Waste: ${p.reason}`, timestamp: Date.now(), kind: "waste",
          };
          return {
            waste: [entry, ...s.waste],
            stockItems: s.stockItems.map((x) => (x.id === item.id ? { ...x, currentBalance: newBalance, updatedAt: Date.now() } : x)),
            stockHistory: [hist, ...s.stockHistory],
          };
        });
      },
      deleteWaste: (id) => set((s) => ({ waste: s.waste.filter((w) => w.id !== id) })),

      addSupplier: (name) => {
        const n = name?.trim();
        if (!n) return;
        set((s) => (s.suppliers.includes(n) ? s : { suppliers: [...s.suppliers, n] }));
      },
    }),
    {
      name: "cafeos-store",
      // Bump `version` and add a case in `migrate` whenever the persisted
      // shape needs a change that would otherwise break existing sessions.
      version: 6,
      migrate: (persisted: any, _version) => {
        // v3: ensure the demo `chef@cafe.com` user exists on older snapshots.
        if (persisted && Array.isArray(persisted.users)) {
          const hasChef = persisted.users.some((u: any) => u.email === "chef@cafe.com");
          if (!hasChef) {
            persisted.users = [
              ...persisted.users,
              { id: "chef-1", name: "Ravi", email: "chef@cafe.com", role: "chef", active: true, password: "chef123" },
            ];
          }
        }
        // v4: backfill kitchenStatus / sentToKitchenAt / updatedAt on old orders.
        if (persisted && Array.isArray(persisted.orders)) {
          persisted.orders = persisted.orders.map((o: any) => ({
            ...o,
            kitchenStatus: o.kitchenStatus ?? (o.status === "completed" || o.status === "cancelled" ? "served" : "queued"),
            sentToKitchenAt: o.sentToKitchenAt ?? o.createdAt ?? Date.now(),
            updatedAt: o.updatedAt ?? o.createdAt ?? Date.now(),
          }));
        }
        // v5: seed the demo `manager@cafe.com` account.
        if (persisted && Array.isArray(persisted.users)) {
          const hasManager = persisted.users.some((u: any) => u.email === "manager@cafe.com");
          if (!hasManager) {
            persisted.users = [
              ...persisted.users,
              { id: "manager-1", name: "Priya", email: "manager@cafe.com", role: "manager", active: true, password: "manager123" },
            ];
          }
        }
        // v6: backfill default categories array if missing
        if (persisted && (!Array.isArray(persisted.categories) || persisted.categories.length === 0)) {
          persisted.categories = DEFAULT_CATEGORIES;
        }
        return persisted;
      },
    },
  ),
);

/**
 * Convenience hook: the currently-logged-in user object, or `null`.
 * Delegates to Supabase Auth via the AuthProvider — never localStorage.
 */
export { useCurrentUser } from "@/hooks/use-auth";

// ---------------------------------------------------------------------------
// Back-compat re-exports
// New code should import formatters from "@/lib/format" and date helpers
// from "@/lib/date-range". These aliases keep older imports working.
// ---------------------------------------------------------------------------
export const formatMoney = money;

/** Midnight (local time) of the day containing `ts`, as an epoch-ms number. */
export const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
