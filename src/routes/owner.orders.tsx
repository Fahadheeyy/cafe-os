/**
 * Order history (`/owner/orders`). Filter by status, mark unpaid orders
 * paid via UPI/Cash, and reprint receipts. Backed by Supabase.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { OwnerShell } from "@/components/owner-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useOrders, useMarkOrderPaid, useCancelOrder } from "@/hooks/use-orders";
import { money as formatMoney } from "@/lib/format";
import { printBill, type PrintSettings } from "@/lib/print";
import { tryRun } from "@/lib/notify";
import type { Order } from "@/lib/services/orders.service";

export const Route = createFileRoute("/owner/orders")({
  ssr: false,
  component: () => (
    <AuthGuard role="owner">
      <OwnerShell title="Orders">
        <OrdersPage />
      </OwnerShell>
    </AuthGuard>
  ),
});

function OrdersPage() {
  const { business } = useAuth();
  const { data: orders = [], isLoading } = useOrders();
  const markPaid = useMarkOrderPaid();
  const cancel = useCancelOrder();
  const currency = business?.currency ?? "INR";

  const [filter, setFilter] = useState<"today" | "completed" | "pending" | "cancelled" | "all">("today");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const printSettings: PrintSettings = { restaurantName: business?.name ?? "", currency, taxPercent: business?.tax_percent ?? 0 };

  const filtered = useMemo(() => {
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const t0 = today0.getTime();
    return orders
      .filter((o) => {
        if (filter === "today") return o.createdAt >= t0;
        if (filter === "completed") return o.status === "completed";
        if (filter === "pending") return o.status === "pending";
        if (filter === "cancelled") return o.status === "cancelled";
        return true;
      })
      .filter((o) => !q || (o.tableName ?? "").toLowerCase().includes(q.toLowerCase()) || o.staffName.toLowerCase().includes(q.toLowerCase()));
  }, [orders, filter, q]);

  const handlePaid = async (orderId: string, method: "upi" | "cash") => {
    try {
      await markPaid.mutateAsync({ orderId, method });
      toast.success(`Paid · ${method.toUpperCase()}`);
      setSelected(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleCancel = async (orderId: string) => {
    try {
      await cancel.mutateAsync(orderId);
      toast.success("Cancelled");
      setSelected(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="-mx-1 px-1 overflow-x-auto">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by table or staff..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card className="rounded-2xl overflow-hidden border">
        {isLoading ? (
          <div className="p-16 grid place-items-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-sm text-muted-foreground">No orders match your filters.</div>
        ) : (
          <div className="divide-y">
            <div className="hidden md:grid grid-cols-[1fr_2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/40">
              <span>Table</span><span>Items</span><span>Staff</span><span>Total</span><span>Time</span><span>Status</span>
            </div>
            {filtered.map((o) => (
              <button key={o.id} onClick={() => setSelected(o)} className="w-full text-left grid grid-cols-2 md:grid-cols-[1fr_2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-4 hover:bg-accent/40 transition items-center">
                <div><p className="font-medium text-sm">{o.tableName}</p></div>
                <div className="md:col-auto col-span-2 order-3 md:order-none text-xs text-muted-foreground truncate">
                  {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ") || "—"}
                </div>
                <div className="text-sm text-muted-foreground truncate hidden md:block">{o.staffName}</div>
                <div className="text-sm font-semibold">{formatMoney(o.total, currency)}</div>
                <div className="text-xs text-muted-foreground hidden md:block">{new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                <Badge className={o.payment === "paid" ? "bg-primary" : o.status === "cancelled" ? "" : "bg-amber-500"} variant={o.status === "cancelled" ? "secondary" : "default"}>
                  {o.status === "cancelled" ? "Cancelled" : o.payment === "paid" ? "Paid" : "Unpaid"}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </Card>

      {selected && business ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => setSelected(null)}>
          <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border shadow-xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Order</p>
                <h3 className="text-lg font-semibold">{selected.tableName}</h3>
                <p className="text-xs text-muted-foreground">{new Date(selected.createdAt).toLocaleString()} · {selected.staffName}</p>
              </div>
              <Badge className={selected.payment === "paid" ? "bg-primary" : "bg-amber-500"}>{selected.payment === "paid" ? `Paid · ${(selected.paymentMethod ?? "cash").toUpperCase()}` : "Unpaid"}</Badge>
            </div>
            <div className="border rounded-xl divide-y">
              {selected.items.map((i, idx) => (
                <div key={`${i.productId ?? "x"}-${idx}`} className="flex justify-between px-4 py-2.5 text-sm">
                  <span>{i.qty}× {i.name}</span>
                  <span className="font-medium">{formatMoney(i.price * i.qty, currency)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span><span>{formatMoney(selected.total, currency)}</span>
            </div>
            {selected.status === "pending" && selected.payment === "unpaid" ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => handlePaid(selected.id, "upi")} disabled={markPaid.isPending}>Paid · UPI</Button>
                <Button onClick={() => handlePaid(selected.id, "cash")} disabled={markPaid.isPending}>Paid · Cash</Button>
                <Button variant="outline" onClick={() => tryRun(() => printBill(selected, printSettings), { error: "Could not print bill" })}><Printer className="h-4 w-4 mr-1" /> Print</Button>
                <Button variant="outline" onClick={() => handleCancel(selected.id)} disabled={cancel.isPending}>Cancel</Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => tryRun(() => printBill(selected, printSettings), { error: "Could not print bill" })}><Printer className="h-4 w-4 mr-1" /> Print</Button>
                <Button onClick={() => setSelected(null)}>Close</Button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
