/**
 * Manager Orders (`/manager/orders`). Today's bills with reprint + settle.
 * Backed by Supabase.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Printer, Wallet, Banknote, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { ManagerShell } from "@/components/manager-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchInput, EmptyState } from "@/components/ui-kit";
import { useAuth } from "@/hooks/use-auth";
import { useOrders, useMarkOrderPaid } from "@/hooks/use-orders";
import type { PaymentMethod } from "@/lib/services/orders.service";
import { money as formatMoney } from "@/lib/format";
import { printBill, type PrintSettings } from "@/lib/print";
import { tryRun } from "@/lib/notify";
import { todayRange } from "@/lib/date-range";

export const Route = createFileRoute("/manager/orders")({
  ssr: false,
  component: () => (
    <AuthGuard role="manager">
      <ManagerShell title="Orders">
        <ManagerOrders />
      </ManagerShell>
    </AuthGuard>
  ),
});

function ManagerOrders() {
  const { business } = useAuth();
  const { data: orders = [], isLoading } = useOrders();
  const markPaid = useMarkOrderPaid();
  const currency = business?.currency ?? "INR";
  const printSettings: PrintSettings = { restaurantName: business?.name ?? "", currency, taxPercent: business?.tax_percent ?? 0 };
  const [filter, setFilter] = useState<"today" | "unpaid" | "paid">("today");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t0 = todayRange().start;
    return orders
      .filter((o) => {
        if (filter === "today") return o.createdAt >= t0;
        if (filter === "unpaid") return o.status === "pending" && o.payment === "unpaid";
        return o.payment === "paid";
      })
      .filter((o) => !q || o.tableName.toLowerCase().includes(q.toLowerCase()) || o.staffName.toLowerCase().includes(q.toLowerCase()));
  }, [orders, filter, q]);

  const settle = async (id: string, method: PaymentMethod) => {
    try {
      await markPaid.mutateAsync({ orderId: id, method });
      toast.success(`Paid via ${method.toUpperCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="-mx-1 px-1 overflow-x-auto">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
              <TabsTrigger value="paid">Paid</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search table or staff…" className="sm:ml-auto sm:w-64" />
      </div>

      {isLoading ? (
        <div className="p-10 grid place-items-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl"><EmptyState title="No orders" description="Nothing here yet." /></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((o) => (
            <Card key={o.id} className="p-4 rounded-2xl border shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{o.tableName}</p>
                    <Badge variant={o.payment === "paid" ? "default" : "secondary"} className={o.payment === "paid" ? "bg-emerald-600" : ""}>
                      {o.payment === "paid" ? `Paid · ${(o.paymentMethod ?? "").toUpperCase()}` : "Unpaid"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {o.staffName} · {o.items.length} items
                  </p>
                </div>
                <p className="text-lg font-semibold">{formatMoney(o.total, currency)}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {o.payment === "unpaid" && o.status === "pending" && (
                  <>
                    <Button size="sm" className="min-h-10" onClick={() => settle(o.id, "upi")} disabled={markPaid.isPending}>
                      <Wallet className="h-4 w-4 mr-1" /> UPI
                    </Button>
                    <Button size="sm" className="min-h-10" onClick={() => settle(o.id, "cash")} disabled={markPaid.isPending}>
                      <Banknote className="h-4 w-4 mr-1" /> Cash
                    </Button>
                  </>
                )}
                <Button size="sm" variant="outline" className="min-h-10" onClick={() => tryRun(() => printBill(o, printSettings), { error: "Print failed" })}>
                  <Printer className="h-4 w-4 mr-1" /> Print
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
