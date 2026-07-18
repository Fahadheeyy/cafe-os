/**
 * Business reports (`/owner/reports`). Daily closing report + P&L
 * summary combining sales, expenses, waste, and top products.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { OwnerShell } from "@/components/owner-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/store";
import { stockStatus } from "@/lib/services/inventory.service";
import { useOrders } from "@/hooks/use-orders";
import {
  usePurchases, useExpenses, useWaste, useStockItems, usePurchaseRequests,
} from "@/hooks/use-inventory";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/owner/reports")({
  ssr: false,
  component: () => (
    <AuthGuard role="owner">
      <OwnerShell title="Daily Closing Report">
        <Report />
      </OwnerShell>
    </AuthGuard>
  ),
});

function Report() {
  const { data: orders = [] } = useOrders();
  const { data: purchases = [] } = usePurchases();
  const { data: expenses = [] } = useExpenses();
  const { data: waste = [] } = useWaste();
  const { data: stock = [] } = useStockItems();
  const { data: requests = [] } = usePurchaseRequests();
  const { business } = useAuth();
  const currency = business?.currency ?? "INR";
  const restaurantName = business?.name ?? "";

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = dayStart.getTime() + 86400000;
  const start = dayStart.getTime();

  const inRange = (ts: number) => ts >= start && ts < dayEnd;

  const paid = orders.filter((o) => o.payment === "paid" && inRange(o.paidAt ?? o.createdAt));
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const orderCount = orders.filter((o) => inRange(o.createdAt)).length;
  const purchasesTotal = purchases.filter((p) => inRange(p.purchaseDate)).reduce((s, p) => s + p.total, 0);
  const expensesTotal = expenses.filter((e) => inRange(e.expenseDate)).reduce((s, e) => s + e.amount, 0);
  const wasteCost = waste.filter((w) => inRange(w.createdAt)).reduce((s, w) => s + w.estimatedCost, 0);
  const profit = revenue - expensesTotal - wasteCost;

  const lowStock = stock.filter((s) => stockStatus(s) !== "sufficient");
  const pendingRequests = requests.filter((r) => r.status === "pending");

  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    paid.forEach((o) => o.items.forEach((it) => {
      const key = it.productId ?? it.name;
      map[key] = map[key] || { name: it.name, qty: 0, revenue: 0 };
      map[key].qty += it.qty;
      map[key].revenue += it.qty * it.price;
    }));
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [paid]);

  const kpi = [
    { label: "Revenue", value: formatMoney(revenue, currency), tone: "text-emerald-600" },
    { label: "Orders", value: String(orderCount) },
    { label: "Purchases", value: formatMoney(purchasesTotal, currency), tone: "text-blue-600" },
    { label: "Expenses", value: formatMoney(expensesTotal, currency), tone: "text-amber-600" },
    { label: "Waste", value: formatMoney(wasteCost, currency), tone: "text-red-600" },
    { label: "Estimated Profit", value: formatMoney(profit, currency), tone: profit >= 0 ? "text-emerald-600" : "text-red-600" },
  ];

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-end gap-3 print:hidden">
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-48" />
        </div>
        <button onClick={() => window.print()} className="ml-auto text-sm rounded-lg border px-4 py-2 hover:bg-accent">
          Print / Export PDF
        </button>
      </div>

      <Card className="p-6 rounded-2xl">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{restaurantName}</h2>
            <p className="text-xs text-muted-foreground">Daily Closing · {dayStart.toDateString()}</p>
          </div>
        </div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
          {kpi.map((k) => (
            <div key={k.label} className="p-4 rounded-xl border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</p>
              <p className={`text-2xl font-semibold mt-1 ${k.tone ?? ""}`}>{k.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 rounded-2xl">
          <h3 className="text-sm font-semibold mb-3">Top Selling Products</h3>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No sales.</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p) => (
                <div key={p.name} className="flex justify-between items-center p-2 rounded-lg border">
                  <span className="text-sm font-medium">{p.name}</span>
                  <div className="text-right">
                    <p className="text-sm">{p.qty} sold</p>
                    <p className="text-xs text-muted-foreground">{formatMoney(p.revenue, currency)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 rounded-2xl">
          <h3 className="text-sm font-semibold mb-3">Low Stock ({lowStock.length})</h3>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">All stock healthy.</p>
          ) : (
            <div className="space-y-2">
              {lowStock.map((s) => (
                <div key={s.id} className="flex justify-between items-center p-2 rounded-lg border">
                  <span className="text-sm">{s.name}</span>
                  <Badge variant="secondary">{s.currentBalance} {s.unit}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 rounded-2xl lg:col-span-2">
          <h3 className="text-sm font-semibold mb-3">Pending Purchase Requests ({pendingRequests.length})</h3>
          {pendingRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No pending requests.</p>
          ) : (
            <div className="space-y-2">
              {pendingRequests.map((r) => {
                const it = stock.find((s) => s.id === r.stockItemId);
                return (
                  <div key={r.id} className="flex justify-between items-center p-2 rounded-lg border">
                    <span className="text-sm">{it?.name ?? "—"}</span>
                    <span className="text-sm text-muted-foreground">{r.requestedQuantity} {r.unit} · {r.priority}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
