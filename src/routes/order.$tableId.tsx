/**
 * POS order screen (`/order/$tableId`). The heart of the app: menu on
 * the left, cart on the right (desktop) or bottom sheet (mobile).
 * All order writes go through atomic server RPCs.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Minus, Plus, ShoppingCart, Trash2, Printer, X, UtensilsCrossed, Loader2, FileText, NotebookPen, Send, Package } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { EmptyState, SearchInput } from "@/components/ui-kit";
import { type Category } from "@/lib/services/products.service";
import type { OrderItem, PaymentMethod } from "@/lib/services/orders.service";
import { money } from "@/lib/format";
import { printBill } from "@/lib/print";
import { useAuth } from "@/hooks/use-auth";
import { useAvailableProducts } from "@/hooks/use-products";
import { useCategories } from "@/hooks/use-categories";
import { useTable, useSetTableStatus } from "@/hooks/use-tables";
import { useMarkOrderPaid, useOpenOrder, useUpsertOrder } from "@/hooks/use-orders";
import { getOrder } from "@/lib/services/orders.service";

export const Route = createFileRoute("/order/$tableId")({
  ssr: false,
  component: () => (
    <AuthGuard role={["owner", "manager", "staff"]}>
      <OrderScreen />
    </AuthGuard>
  ),
});

function OrderScreen() {
  const { tableId } = Route.useParams();
  const navigate = useNavigate();
  const { role, business } = useAuth();
  const currency = business?.currency ?? "₹";
  const taxPercent = business?.tax_percent ?? 0;
  const restaurantName = business?.name ?? "CafeOS";

  const isStaff = role === "staff";
  const _table = useTable(tableId);
  const isTakeaway = tableId === "takeaway";
  const table = isTakeaway ? { id: "takeaway", name: "Takeaway", status: "available" } : _table;
  const parcelFeeSetting = business?.parcel_fee ?? 0;

  const { categories } = useCategories();
  const { data: products = [], isLoading: pLoading } = useAvailableProducts();
  const { data: openOrder, isLoading: oLoading } = useOpenOrder(isTakeaway ? undefined : tableId);
  const upsertMut = useUpsertOrder();
  const markPaidMut = useMarkOrderPaid();
  const setStatusMut = useSetTableStatus();

  const homePath = role === "owner" ? "/owner/tables" : role === "manager" ? "/manager/dashboard" : "/staff";

  const [cart, setCart] = useState<OrderItem[] | null>(null);
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [cat, setCat] = useState<Category>(categories[0] ?? "Tea");

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(cat)) {
      setCat(categories[0]);
    }
  }, [categories, cat]);
  const [q, setQ] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">(isTakeaway ? "takeaway" : "dine_in");
  const [customParcelFee, setCustomParcelFee] = useState<number | null>(null);

  // Hydrate cart, notes, and parcel fee from open order once loaded
  useEffect(() => {
    if (cart === null && !oLoading) {
      setCart(openOrder?.items ?? []);
      if (openOrder?.orderType) setOrderType(openOrder.orderType);
      if (openOrder?.notes) setOrderNotes(openOrder.notes);
      if (openOrder?.parcelFee !== undefined && openOrder?.parcelFee !== null) {
        setCustomParcelFee(openOrder.parcelFee);
      }
    }
  }, [cart, oLoading, openOrder]);

  useEffect(() => {
    if (!table && !oLoading && !isTakeaway) navigate({ to: homePath, replace: true });
  }, [table, oLoading, navigate, homePath, isTakeaway]);

  const currentCart = cart ?? [];
  const filtered = useMemo(() => {
    const query = q.toLowerCase();
    return products.filter((p) => p.category === cat && (!query || p.name.toLowerCase().includes(query)));
  }, [products, cat, q]);

  const itemsTotal = currentCart.reduce((s, i) => s + i.price * i.qty, 0);
  const totalQty = currentCart.reduce((s, i) => s + i.qty, 0);

  // Active parcel fee logic: owner default, but editable by staff/user for takeaway orders
  const activeParcelFee = orderType === "takeaway" ? (customParcelFee ?? parcelFeeSetting) : 0;
  const total = itemsTotal + activeParcelFee;

  const add = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setCart((prev) => {
      const c = prev ?? [];
      const existing = c.find((i) => i.productId === id);
      if (existing) return c.map((i) => (i.productId === id ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { productId: id, name: p.name, price: p.price, qty: 1 }];
    });
  };

  const dec = (id: string) =>
    setCart((prev) => (prev ?? []).flatMap((i) => (i.productId === id ? (i.qty > 1 ? [{ ...i, qty: i.qty - 1 }] : []) : [i])));

  const remove = (id: string) => setCart((prev) => (prev ?? []).filter((i) => i.productId !== id));

  const updateItemNotes = (productId: string, notes: string) => {
    setCart((prev) => (prev ?? []).map((i) => (i.productId === productId ? { ...i, notes } : i)));
  };

  const saveOrder = async () => {
    if (!currentCart.length) return toast.error("Add items first");
    try {
      await upsertMut.mutateAsync({
        tableId: isTakeaway ? null : tableId,
        items: currentCart,
        orderType,
        parcelFee: activeParcelFee,
        orderId: openOrder?.id,
        notes: orderNotes,
      });
      toast.success("Order sent to kitchen!");
      if (isTakeaway || isStaff) navigate({ to: homePath });
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : err instanceof Error ? err.message : "Could not save order";
      toast.error(msg);
    }
  };

  const printCurrent = async () => {
    if (!currentCart.length) return toast.error("Add items first");
    try {
      const id = await upsertMut.mutateAsync({
        tableId: isTakeaway ? null : tableId,
        items: currentCart,
        orderType,
        parcelFee: activeParcelFee,
        orderId: openOrder?.id,
        notes: orderNotes,
      });
      const fresh = await getOrder(id);
      if (fresh) printBill(fresh, { restaurantName, currency, taxPercent });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not print");
    }
  };

  const payNow = async () => {
    if (!currentCart.length) return toast.error("Add items first");
    try {
      const id = await upsertMut.mutateAsync({
        tableId: isTakeaway ? null : tableId,
        items: currentCart,
        orderType,
        parcelFee: activeParcelFee,
        orderId: openOrder?.id,
        notes: orderNotes,
      });
      await markPaidMut.mutateAsync({ orderId: id, method });
      toast.success(`Paid via ${method.toUpperCase()}`);
      navigate({ to: homePath });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    }
  };

  const payAndPrint = async () => {
    if (!currentCart.length) return toast.error("Add items first");
    try {
      const id = await upsertMut.mutateAsync({
        tableId: isTakeaway ? null : tableId,
        items: currentCart,
        orderType,
        parcelFee: activeParcelFee,
        orderId: openOrder?.id,
        notes: orderNotes,
      });
      await markPaidMut.mutateAsync({ orderId: id, method });
      const paid = await getOrder(id);
      if (paid) printBill(paid, { restaurantName, currency, taxPercent });
      toast.success(`Paid via ${method.toUpperCase()} — printing bill`);
      navigate({ to: homePath });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment or print failed");
    }
  };

  const clearTable = async () => {
    if (openOrder) return toast.error("Save or pay the order first");
    try {
      if (tableId && !isTakeaway) {
        await setStatusMut.mutateAsync({ id: tableId, status: "available" });
      }
      navigate({ to: homePath });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not free table");
    }
  };

  if (!table || cart === null) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const busy = upsertMut.isPending || markPaidMut.isPending;

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="h-16 border-b bg-background/80 backdrop-blur sticky top-0 z-30 flex items-center px-4 gap-3">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate({ to: homePath })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Order</p>
          <h1 className="text-lg font-semibold truncate leading-tight">{table.name}</h1>
        </div>
        <div className="hidden lg:flex items-center gap-1 bg-muted p-1 rounded-xl mr-2">
          <button
            onClick={() => setOrderType("dine_in")}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
              orderType === "dine_in" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Dine In
          </button>
          <button
            onClick={() => setOrderType("takeaway")}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
              orderType === "takeaway" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Parcel
          </button>
        </div>
        <button
          onClick={() => setCartOpen(true)}
          className="lg:hidden relative rounded-xl border px-3 py-2 flex items-center gap-2 active:scale-95 transition"
        >
          <ShoppingCart className="h-4 w-4" />
          <span className="text-sm font-medium">{money(total, currency)}</span>
          {totalQty > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold grid place-items-center">
              {totalQty}
            </span>
          )}
        </button>
      </header>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="p-4 border-b">
            <SearchInput value={q} onChange={setQ} placeholder="Search menu…" ariaLabel="Search menu" />
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`px-4 h-9 rounded-full text-sm font-medium whitespace-nowrap transition ${
                    cat === c ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 pb-32 lg:pb-4">
            {pLoading ? (
              <div className="grid place-items-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={UtensilsCrossed} description="No items in this category." />
            ) : (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((p) => {
                  const inCart = currentCart.find((i) => i.productId === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => add(p.id)}
                      className="p-4 rounded-2xl border bg-card shadow-sm hover:border-primary/50 hover:shadow-md active:scale-[0.98] transition text-left flex flex-col gap-2 min-h-[110px]"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm leading-snug">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{money(p.price, currency)}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        {inCart ? <span className="text-xs font-semibold text-primary">{inCart.qty} in cart</span> : <span />}
                        <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center">
                          <Plus className="h-4 w-4" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <aside className="hidden lg:flex w-96 border-l bg-card flex-col">
          <CartPanel
            busy={busy}
            cart={currentCart}
            total={total}
            itemsTotal={itemsTotal}
            parcelFee={activeParcelFee}
            onParcelFeeChange={(val) => setCustomParcelFee(val)}
            orderType={orderType}
            currency={currency}
            method={method}
            onMethod={setMethod}
            onDec={dec}
            onAdd={add}
            onRemove={remove}
            onUpdateItemNotes={updateItemNotes}
            orderNotes={orderNotes}
            onOrderNotesChange={setOrderNotes}
            onSave={saveOrder}
            onPay={payNow}
            onPayPrint={payAndPrint}
            onPrint={printCurrent}
            onClear={clearTable}
            isStaff={isStaff}
          />
        </aside>
      </div>

      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setCartOpen(false)}>
          <div className="absolute bottom-0 inset-x-0 bg-card rounded-t-2xl border-t max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <p className="font-semibold">Order · {table.name}</p>
              <Button variant="ghost" size="icon" aria-label="Close cart" onClick={() => setCartOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CartPanel
              busy={busy}
              cart={currentCart}
              total={total}
              itemsTotal={itemsTotal}
              parcelFee={activeParcelFee}
              onParcelFeeChange={(val) => setCustomParcelFee(val)}
              orderType={orderType}
              currency={currency}
              method={method}
              onMethod={setMethod}
              onDec={dec}
              onAdd={add}
              onRemove={remove}
              onUpdateItemNotes={updateItemNotes}
              orderNotes={orderNotes}
              onOrderNotesChange={setOrderNotes}
              onSave={async () => {
                await saveOrder();
                setCartOpen(false);
              }}
              onPay={payNow}
              onPayPrint={payAndPrint}
              onPrint={printCurrent}
              onClear={clearTable}
              isStaff={isStaff}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CartPanel({
  cart,
  total,
  itemsTotal,
  parcelFee,
  onParcelFeeChange,
  orderType,
  currency,
  method,
  onMethod,
  onDec,
  onAdd,
  onRemove,
  onUpdateItemNotes,
  orderNotes,
  onOrderNotesChange,
  onSave,
  onPay,
  onPayPrint,
  onPrint,
  onClear,
  busy,
  isStaff,
}: {
  cart: OrderItem[];
  total: number;
  itemsTotal: number;
  parcelFee: number;
  onParcelFeeChange: (val: number) => void;
  orderType: "dine_in" | "takeaway";
  currency: string;
  busy: boolean;
  isStaff: boolean;
  method: PaymentMethod;
  onMethod: (m: PaymentMethod) => void;
  onDec: (id: string) => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdateItemNotes: (id: string, notes: string) => void;
  orderNotes: string;
  onOrderNotesChange: (n: string) => void;
  onSave: () => void;
  onPay: () => void;
  onPayPrint: () => void;
  onPrint: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="p-4 border-b hidden lg:block">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Current order</p>
        <p className="text-lg font-semibold">{cart.length} {cart.length === 1 ? "item" : "items"}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <EmptyState icon={ShoppingCart} description="Tap a product to add it here." />
        ) : (
          <ul className="p-3 space-y-2">
            {cart.map((i) => (
              <li key={i.productId ?? i.name} className="p-3 rounded-xl border bg-background">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{money(i.price, currency)} each</p>
                  </div>
                  <button
                    onClick={() => i.productId && onRemove(i.productId)}
                    className="text-muted-foreground hover:text-destructive p-1"
                    aria-label={`Remove ${i.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => i.productId && onDec(i.productId)}
                      className="h-8 w-8 rounded-lg border grid place-items-center hover:bg-accent active:scale-95 transition"
                      aria-label={`Decrease ${i.name}`}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium" aria-live="polite">{i.qty}</span>
                    <button
                      onClick={() => i.productId && onAdd(i.productId)}
                      className="h-8 w-8 rounded-lg border grid place-items-center hover:bg-accent active:scale-95 transition"
                      aria-label={`Increase ${i.name}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="text-sm font-semibold">{money(i.price * i.qty, currency)}</span>
                </div>
                
                {/* Item Note Input */}
                <div className="mt-2.5 pt-2 border-t border-dashed flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <input
                    type="text"
                    placeholder="Item note (e.g. less spicy, customer opinion...)"
                    value={i.notes ?? ""}
                    onChange={(e) => i.productId && onUpdateItemNotes(i.productId, e.target.value)}
                    className="w-full text-xs bg-muted/50 border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t p-4 space-y-3 bg-card">
        {/* Kitchen Order Note */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
            <NotebookPen className="h-3.5 w-3.5 text-primary" /> Kitchen Note / Customer Request
          </label>
          <textarea
            rows={2}
            placeholder="Add note for kitchen (e.g. customer needs opinion on food sweetness, extra hot)..."
            value={orderNotes}
            onChange={(e) => onOrderNotesChange(e.target.value)}
            className="w-full text-xs bg-background border rounded-xl p-2.5 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <div className="space-y-2 border-t pt-3">
          <div className="flex justify-between items-baseline text-sm">
            <span className="text-muted-foreground">Items Total</span>
            <span className="font-medium">{money(itemsTotal, currency)}</span>
          </div>

          {/* Editable Parcel Fee for Takeaway Orders */}
          {orderType === "takeaway" && (
            <div className="flex justify-between items-center text-sm py-0.5">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-blue-500 shrink-0" /> Parcel / Packaging Fee
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">{currency}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={parcelFee}
                  onChange={(e) => onParcelFeeChange(Math.max(0, Number(e.target.value)))}
                  className="w-20 h-8 text-right text-sm font-semibold bg-background border rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="0"
                />
              </div>
            </div>
          )}

          <div className="flex justify-between items-baseline pt-1">
            <span className="text-sm font-semibold">Grand total</span>
            <span className="text-2xl font-bold tracking-tight">{money(total, currency)}</span>
          </div>
        </div>

        {/* Staff UI: Only Take Order / Send to Kitchen */}
        {isStaff ? (
          <Button className="w-full min-h-12 text-base font-semibold shadow-md" onClick={onSave} disabled={busy}>
            <Send className="h-4 w-4 mr-2" /> Send to Kitchen
          </Button>
        ) : (
          /* Owner / Manager UI: Includes payment and print options */
          <>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Payment method</p>
              <div className="grid grid-cols-2 gap-2">
                {(["upi", "cash"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => onMethod(m)}
                    className={`h-10 rounded-xl border text-sm font-medium transition ${
                      method === m ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-background hover:bg-accent"
                    }`}
                  >
                    {m === "upi" ? "UPI" : "Cash"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={onSave} disabled={busy}>
                <Send className="h-4 w-4 mr-1" /> Send to Kitchen
              </Button>
              <Button onClick={onPay} disabled={busy}>Mark paid</Button>
            </div>
            <Button className="w-full" variant="secondary" onClick={onPayPrint} disabled={busy}>
              <Printer className="h-4 w-4 mr-1" /> Pay & print bill
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" size="sm" onClick={onPrint} disabled={busy}>
                <Printer className="h-4 w-4 mr-1" /> Print bill
              </Button>
              <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>Free table</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
