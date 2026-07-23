/**
 * Manager Dashboard (`/manager/dashboard`). Billing-focused live floor
 * view + today's revenue KPIs. Managers can settle bills (UPI/Cash) and
 * print receipts but cannot access analytics, menu, or staff admin.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Wallet, Banknote, Receipt, TrendingUp, ShoppingBag, ArrowRight } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { ManagerShell } from "@/components/manager-shell";
import { FloorOps } from "@/components/floor-ops";
import { StatCard } from "@/components/ui-kit";
import { useAuth } from "@/hooks/use-auth";
import { money as formatMoney } from "@/lib/format";
import { useOrders } from "@/hooks/use-orders";
import { todayRange } from "@/lib/date-range";

export const Route = createFileRoute("/manager/dashboard")({
  ssr: false,
  component: () => (
    <AuthGuard role="manager">
      <ManagerShell title="Billing">
        <ManagerDashboard />
      </ManagerShell>
    </AuthGuard>
  ),
});

function ManagerDashboard() {
  const { data: orders = [] } = useOrders();
  const { business } = useAuth();
  const currency = business?.currency ?? "₹";

  const kpis = useMemo(() => {
    const t0 = todayRange().start;
    const paidToday = orders.filter((o) => o.payment === "paid" && (o.paidAt ?? o.createdAt) >= t0);
    const upi = paidToday.filter((o) => o.paymentMethod === "upi").reduce((s, o) => s + o.total, 0);
    const cash = paidToday.filter((o) => o.paymentMethod === "cash").reduce((s, o) => s + o.total, 0);
    return { count: paidToday.length, upi, cash, total: upi + cash };
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Quick Action: Parcel / Takeaway Order */}
      <Link
        to={"/order/takeaway" as any}
        className="flex items-center gap-4 p-4 rounded-2xl border-2 border-blue-200 bg-blue-50/60 hover:bg-blue-100/60 hover:border-blue-300 transition group"
      >
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-600 text-white shrink-0">
          <ShoppingBag className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-blue-900">New Parcel / Takeaway Order</p>
          <p className="text-xs text-blue-600 mt-0.5">Tap to open the POS for a walk-in takeaway customer</p>
        </div>
        <ArrowRight className="h-5 w-5 text-blue-400 group-hover:translate-x-0.5 transition" />
      </Link>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's revenue" value={formatMoney(kpis.total, currency)} icon={TrendingUp} tone="success" />
        <StatCard label="Bills settled" value={kpis.count} icon={Receipt} />
        <StatCard label="UPI collected" value={formatMoney(kpis.upi, currency)} icon={Wallet} tone="info" />
        <StatCard label="Cash collected" value={formatMoney(kpis.cash, currency)} icon={Banknote} tone="warning" />
      </div>
      <FloorOps manageTablesHref="/manager/dashboard" />
    </div>
  );
}

