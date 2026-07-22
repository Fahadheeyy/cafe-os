/**
 * Live floor / billing operations view.
 * Shared between owner (`/owner/operations`) and manager (`/manager/dashboard`).
 * Backed by Supabase Realtime through `useOrders` / `useTables`.
 */
import { Link } from "@tanstack/react-router";
import * as React from "react";
import { useMemo, useState } from "react";
import { Printer, CheckCircle2, ChefHat, Utensils, Wallet, Banknote, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatCard, SectionCard, EmptyState, StatusPill, PageHeader } from "@/components/ui-kit";
import { money } from "@/lib/format";
import { printBill } from "@/lib/print";
import { useAuth } from "@/hooks/use-auth";
import { useOrders, useMarkOrderPaid, useSetKitchenStatus, useCancelOrder } from "@/hooks/use-orders";
import { useTables } from "@/hooks/use-tables";
import { getOrder, type KitchenStatus, type Order, type PaymentMethod } from "@/lib/services/orders.service";

const kitchenTone: Record<KitchenStatus, "info" | "warning" | "success" | "neutral"> = {
  queued: "info", preparing: "warning", ready: "success", served: "neutral",
};
const kitchenLabel: Record<KitchenStatus, string> = {
  queued: "Queued", preparing: "Preparing", ready: "Ready", served: "Served",
};

function minsAgo(ts: number) {
  const m = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  return m < 1 ? "just now" : `${m}m`;
}

export function FloorOps({ manageTablesHref = "/owner/tables" }: { manageTablesHref?: string }) {
  const { business } = useAuth();
  const currency = business?.currency ?? "₹";
  const restaurantName = business?.name ?? "CafeOS";
  const taxPercent = business?.tax_percent ?? 0;

  const { data: orders = [], isLoading, isError, error, refetch } = useOrders();
  const { data: tables = [] } = useTables();
  const markPaidMut = useMarkOrderPaid();
  const setKitchenMut = useSetKitchenStatus();
  const cancelMut = useCancelOrder();

  const [filter, setFilter] = useState<"all" | KitchenStatus>("all");

  const active = useMemo(
    () =>
      orders
        .filter((o) => o.status === "pending" && o.payment === "unpaid")
        .slice()
        .sort((a, b) => a.sentToKitchenAt - b.sentToKitchenAt),
    [orders],
  );

  const shown = filter === "all" ? active : active.filter((o) => o.kitchenStatus === filter);

  const kpis: Array<{ label: string; value: React.ReactNode; tone?: "success" | "warning" | "info" | "danger" }> = [
    { label: "Open tickets", value: active.length },
    { label: "In kitchen", value: active.filter((o) => o.kitchenStatus === "queued" || o.kitchenStatus === "preparing").length, tone: "warning" },
    { label: "Awaiting bill", value: active.filter((o) => o.kitchenStatus === "ready" || o.kitchenStatus === "served").length, tone: "info" },
    { label: "Floor revenue", value: money(active.reduce((s, o) => s + o.total, 0), currency) },
    { label: "Free tables", value: `${tables.filter((t) => t.status === "available").length}/${tables.length}`, tone: "success" },
  ];

  const settle = async (order: Order, method: PaymentMethod) => {
    try {
      await markPaidMut.mutateAsync({ orderId: order.id, method });
      toast.success(`Paid via ${method.toUpperCase()}`);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Payment failed"); }
  };

  const settleAndPrint = async (order: Order, method: PaymentMethod) => {
    try {
      await markPaidMut.mutateAsync({ orderId: order.id, method });
      const paid = await getOrder(order.id);
      if (paid) printBill(paid, { restaurantName, currency, taxPercent });
      toast.success(`Settled ${order.tableName} · ${method.toUpperCase()}`);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Could not settle bill"); }
  };

  const advance = async (id: string, ks: KitchenStatus) => {
    try { await setKitchenMut.mutateAsync({ kotId: id, status: ks }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Could not update ticket"); }
  };

  const cancel = async (o: Order) => {
    if (!confirm(`Cancel order for ${o.tableName}?`)) return;
    try { await cancelMut.mutateAsync(o.id); toast.success("Order cancelled"); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Could not cancel"); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live floor"
        subtitle="Active tables, kitchen status, and one-tap billing"
        actions={
          <div className="flex items-center gap-4">
            <Link to={"/order/takeaway" as any} className="text-xs font-medium bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full hover:bg-blue-100 transition">
              + New Takeaway
            </Link>
            <Link to={manageTablesHref} className="text-xs text-primary hover:underline">
              Tables →
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => <StatCard key={k.label} label={k.label} value={k.value} tone={k.tone} />)}
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <div className="p-8 rounded-2xl border text-center space-y-3">
          <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Could not load orders."}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : (
        <SectionCard
          title="Active orders"
          icon={Utensils}
          action={
            <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
              {(["all", "queued", "preparing", "ready", "served"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 h-8 rounded-full text-xs font-medium whitespace-nowrap ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
                >
                  {f === "all" ? "All" : kitchenLabel[f]}
                </button>
              ))}
            </div>
          }
        >
          {shown.length === 0 ? (
            <EmptyState compact icon={CheckCircle2} description="No open tickets in this view." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((o) => (
                <div key={o.id} className="p-4 rounded-2xl border bg-card shadow-sm flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{o.tableName}</p>
                      <p className="text-[11px] text-muted-foreground">{o.staffName} · {minsAgo(o.sentToKitchenAt)} ago</p>
                    </div>
                    <StatusPill tone={kitchenTone[o.kitchenStatus]}>
                      <ChefHat className="h-3 w-3 mr-1" />
                      {kitchenLabel[o.kitchenStatus]}
                    </StatusPill>
                  </div>
                  <ul className="text-xs space-y-0.5 border-t pt-2 mb-3 flex-1">
                    {o.items.slice(0, 5).map((i, k) => (
                      <li key={i.productId ?? k} className="flex justify-between">
                        <span className="truncate"><span className="font-semibold">×{i.qty}</span> {i.name}</span>
                        <span className="text-muted-foreground shrink-0 ml-2">{money(i.price * i.qty, currency)}</span>
                      </li>
                    ))}
                    {o.items.length > 5 && <li className="text-muted-foreground italic">+{o.items.length - 5} more</li>}
                  </ul>
                  <div className="flex justify-between items-baseline border-t pt-2 mb-3">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Total</span>
                    <span className="text-lg font-semibold">{money(o.total, currency)}</span>
                  </div>

                  {o.kitchenStatus !== "served" && (
                    <div className="flex gap-1.5 mb-2">
                      {o.kitchenStatus === "queued" && <Button size="sm" variant="outline" className="flex-1 min-h-10" onClick={() => advance(o.id, "preparing")}>Start</Button>}
                      {o.kitchenStatus === "preparing" && <Button size="sm" variant="outline" className="flex-1 min-h-10" onClick={() => advance(o.id, "ready")}>Ready</Button>}
                      {o.kitchenStatus === "ready" && <Button size="sm" variant="outline" className="flex-1 min-h-10" onClick={() => advance(o.id, "served")}>Served</Button>}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-1.5">
                    <Button size="sm" className="min-h-11" onClick={() => settle(o, "upi")}><Wallet className="h-3.5 w-3.5 mr-1" /> UPI</Button>
                    <Button size="sm" className="min-h-11" onClick={() => settle(o, "cash")}><Banknote className="h-3.5 w-3.5 mr-1" /> Cash</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                    <Button size="sm" variant="secondary" className="min-h-11" onClick={() => settleAndPrint(o, "upi")}><Printer className="h-3.5 w-3.5 mr-1" /> UPI + Print</Button>
                    <Button size="sm" variant="secondary" className="min-h-11" onClick={() => settleAndPrint(o, "cash")}><Printer className="h-3.5 w-3.5 mr-1" /> Cash + Print</Button>
                  </div>
                  <button onClick={() => cancel(o)} className="text-[11px] text-muted-foreground hover:text-destructive mt-2 self-end">
                    Cancel order
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
