/**
 * Owner Dashboard (`/owner/dashboard`). KPI cards, business analytics
 * charts (revenue / expenses / profit over today / week / month / year),
 * low-stock warnings, pending purchase requests, and recent orders.
 * Orders + tables are live from Supabase; inventory/expenses/purchases
 * still come from the local store (Priority 3 migration).
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, lazy, Suspense } from "react";
import { DollarSign, ShoppingBag, TrendingUp, Grid3x3, ShoppingCart, Receipt, Trash2, Wallet, Package, Inbox, Check } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { OwnerShell } from "@/components/owner-shell";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard, SectionCard, EmptyState, StatusPill } from "@/components/ui-kit";
import { startOfDay } from "@/lib/store";
import { stockStatus } from "@/lib/services/inventory.service";
import {
  usePurchases, useExpenses, useWaste, useStockItems, usePurchaseRequests, useSetRequestStatus,
} from "@/hooks/use-inventory";
import { useAuth } from "@/hooks/use-auth";
import { useOrders } from "@/hooks/use-orders";
import { useTables } from "@/hooks/use-tables";
import { money as formatMoney } from "@/lib/format";

const BusinessCharts = lazy(() => import("@/components/business-charts"));

export const Route = createFileRoute("/owner/dashboard")({
  ssr: false,
  component: () => (
    <AuthGuard role="owner">
      <OwnerShell title="Dashboard">
        <Dashboard />
      </OwnerShell>
    </AuthGuard>
  ),
});

function Dashboard() {
  const { business } = useAuth();
  const { data: orders = [] } = useOrders();
  const { data: tables = [] } = useTables();
  const { data: purchases = [] } = usePurchases();
  const { data: expenses = [] } = useExpenses();
  const { data: waste = [] } = useWaste();
  const { data: stock = [] } = useStockItems();
  const { data: requests = [] } = usePurchaseRequests();
  const setRequestStatusM = useSetRequestStatus();
  const setRequestStatus = (id: string, status: Parameters<typeof setRequestStatusM.mutateAsync>[0]["status"]) =>
    setRequestStatusM.mutateAsync({ id, status });
  const currency = business?.currency ?? "INR";
  const navigate = useNavigate();
  const [range, setRange] = useState<"today" | "week" | "month" | "year">("today");

  const now = Date.now();
  const rangeDays = range === "today" ? 1 : range === "week" ? 7 : range === "month" ? 30 : 365;

  const todayStart = startOfDay(now);
  const monthStart = now - 29 * 86400000;

  const sumBy = <T,>(arr: T[], get: (t: T) => number, tsGet: (t: T) => number, from: number, to = now + 1) =>
    arr.filter((x) => tsGet(x) >= from && tsGet(x) < to).reduce((s, x) => s + get(x), 0);

  const paidOrders = useMemo(() => orders.filter((o) => o.payment === "paid"), [orders]);

  const revenueToday = sumBy(paidOrders, (o) => o.total, (o) => o.paidAt ?? o.createdAt, todayStart);
  const purchasesToday = sumBy(purchases, (p) => p.total, (p) => p.purchaseDate, todayStart);
  const expensesToday = sumBy(expenses, (e) => e.amount, (e) => e.expenseDate, todayStart);
  const wasteToday = sumBy(waste, (w) => w.estimatedCost, (w) => w.createdAt, todayStart);
  const profitToday = revenueToday - expensesToday - wasteToday;

  const revenueMonth = sumBy(paidOrders, (o) => o.total, (o) => o.paidAt ?? o.createdAt, monthStart);
  const expensesMonth = sumBy(expenses, (e) => e.amount, (e) => e.expenseDate, monthStart);
  const wasteMonth = sumBy(waste, (w) => w.estimatedCost, (w) => w.createdAt, monthStart);
  const profitMonth = revenueMonth - expensesMonth - wasteMonth;

  const todayOrdersCount = orders.filter((o) => o.createdAt >= todayStart).length;
  const paidToday = paidOrders.filter((o) => (o.paidAt ?? o.createdAt) >= todayStart);
  const aov = paidToday.length ? revenueToday / paidToday.length : 0;
  const occupied = tables.filter((t) => t.status !== "available").length;

  const chartData = useMemo(() => {
    if (range === "today") {
      return Array.from({ length: 12 }, (_, i) => {
        const h = i * 2;
        const start = todayStart + h * 3600000;
        const end = start + 2 * 3600000;
        const rev = sumBy(paidOrders, (o) => o.total, (o) => o.paidAt ?? o.createdAt, start, end);
        const exp = sumBy(expenses, (e) => e.amount, (e) => e.expenseDate, start, end);
        const pur = sumBy(purchases, (p) => p.total, (p) => p.purchaseDate, start, end);
        const wst = sumBy(waste, (w) => w.estimatedCost, (w) => w.createdAt, start, end);
        return { label: `${h}:00`, Revenue: rev, Expenses: exp, Purchases: pur, Profit: rev - exp - wst };
      });
    }
    const days = rangeDays;
    const step = range === "year" ? 30 : 1;
    const buckets = [];
    for (let i = days - step; i >= 0; i -= step) {
      const start = startOfDay(now - i * 86400000);
      const end = start + step * 86400000;
      const rev = sumBy(paidOrders, (o) => o.total, (o) => o.paidAt ?? o.createdAt, start, end);
      const exp = sumBy(expenses, (e) => e.amount, (e) => e.expenseDate, start, end);
      const pur = sumBy(purchases, (p) => p.total, (p) => p.purchaseDate, start, end);
      const wst = sumBy(waste, (w) => w.estimatedCost, (w) => w.createdAt, start, end);
      const d = new Date(start);
      buckets.push({
        label: range === "year" ? `${d.toLocaleString("default", { month: "short" })}` : `${d.getDate()}/${d.getMonth() + 1}`,
        Revenue: rev, Expenses: exp, Purchases: pur, Profit: rev - exp - wst,
      });
    }
    return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidOrders, expenses, purchases, waste, range, rangeDays, todayStart, now]);

  const recent = useMemo(() => orders.slice(0, 5), [orders]);
  const lowStock = stock.filter((s) => stockStatus(s) !== "sufficient").sort((a, b) => a.currentBalance / (a.minimumBalance || 1) - b.currentBalance / (b.minimumBalance || 1)).slice(0, 6);
  const pendingRequests = requests.filter((r) => r.status === "pending").slice(0, 5);

  const stats: Array<{ label: string; value: string; icon: typeof DollarSign; tone?: "success" | "warning" | "danger" | "info" }> = [
    { label: "Today's Revenue", value: formatMoney(revenueToday, currency), icon: DollarSign, tone: "success" },
    { label: "Today's Orders", value: String(todayOrdersCount), icon: ShoppingBag },
    { label: "Avg. Order", value: formatMoney(aov, currency), icon: TrendingUp },
    { label: "Occupied", value: `${occupied}/${tables.length}`, icon: Grid3x3 },
    { label: "Today's Purchases", value: formatMoney(purchasesToday, currency), icon: ShoppingCart, tone: "info" },
    { label: "Today's Expenses", value: formatMoney(expensesToday, currency), icon: Receipt, tone: "warning" },
    { label: "Today's Waste", value: formatMoney(wasteToday, currency), icon: Trash2, tone: "danger" },
    { label: "Today's Profit", value: formatMoney(profitToday, currency), icon: Wallet, tone: profitToday >= 0 ? "success" : "danger" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} tone={s.tone} />
        ))}
      </div>

      <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
        <Card className="p-4 rounded-2xl">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Monthly Revenue</p>
          <p className="text-2xl font-semibold text-emerald-600 mt-1">{formatMoney(revenueMonth, currency)}</p>
        </Card>
        <Card className="p-4 rounded-2xl">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Monthly Expenses</p>
          <p className="text-2xl font-semibold text-amber-600 mt-1">{formatMoney(expensesMonth + wasteMonth, currency)}</p>
        </Card>
        <Card className="p-4 rounded-2xl">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Monthly Profit</p>
          <p className={`text-2xl font-semibold mt-1 ${profitMonth >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatMoney(profitMonth, currency)}</p>
        </Card>
      </div>

      <Card className="p-5 rounded-2xl shadow-sm border">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold">Business Analytics</h3>
            <p className="text-xs text-muted-foreground">Revenue, expenses & profit</p>
          </div>
          <Tabs value={range} onValueChange={(v) => setRange(v as typeof range)}>
            <TabsList>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="year">Year</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Suspense fallback={<div className="h-56 sm:h-64 grid place-items-center text-xs text-muted-foreground">Loading charts…</div>}>
          <BusinessCharts data={chartData} />
        </Suspense>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Low Stock"
          icon={Package}
          action={<Link to="/owner/stock" className="text-xs text-primary hover:underline">View all</Link>}
        >
          {lowStock.length === 0 ? (
            <EmptyState compact description="All stock healthy." />
          ) : (
            <div className="space-y-2">
              {lowStock.map((s) => {
                const st = stockStatus(s);
                return (
                  <button key={s.id} onClick={() => navigate({ to: "/owner/stock" })} className="w-full flex items-center justify-between p-3 rounded-xl border hover:bg-accent/40 text-left transition">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.currentBalance} {s.unit} · min {s.minimumBalance}</p>
                    </div>
                    <StatusPill tone={st === "critical" ? "danger" : "warning"}>
                      {st === "critical" ? "Purchase Required" : "Running Low"}
                    </StatusPill>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Pending Requests"
          icon={Inbox}
          action={<Link to="/owner/requests" className="text-xs text-primary hover:underline">View all</Link>}
        >
          {pendingRequests.length === 0 ? (
            <EmptyState compact description="No pending requests." />
          ) : (
            <div className="space-y-2">
              {pendingRequests.map((r) => {
                const it = stock.find((s) => s.id === r.stockItemId);
                return (
                  <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{it?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{r.requestedQuantity} {r.unit} · {r.priority} priority</p>
                    </div>
                    <Button size="sm" onClick={() => { setRequestStatus(r.id, "approved"); toast.success("Approved"); }}>
                      <Check className="h-3 w-3 mr-1" /> Approve
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Recent Orders"
        action={<Link to="/owner/orders" className="text-xs text-primary hover:underline">View all</Link>}
      >
        {recent.length === 0 ? (
          <EmptyState compact description="No orders yet." />
        ) : (
          <div className="grid gap-2">
            {recent.map((o) => (
              <div key={o.id} className="flex items-center justify-between p-3 rounded-xl border hover:bg-accent/40 transition">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground text-xs font-semibold">
                    {(o.tableName ?? "Takeaway").replace(/[^0-9]/g, "") || (o.tableName ?? "T")[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{o.tableName}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {o.staffName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{formatMoney(o.total, currency)}</span>
                  <Badge variant={o.payment === "paid" ? "default" : "secondary"} className={o.payment === "paid" ? "bg-primary" : ""}>
                    {o.payment === "paid" ? "Paid" : o.status === "cancelled" ? "Cancelled" : "Unpaid"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
