/**
 * Manager Dashboard (`/manager/dashboard`). Billing-focused live floor
 * view + today's revenue KPIs. Managers can settle bills (UPI/Cash) and
 * print receipts but cannot access analytics, menu, or staff admin.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Wallet, Banknote, Receipt, TrendingUp } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { ManagerShell } from "@/components/manager-shell";
import { FloorOps } from "@/components/floor-ops";
import { StatCard } from "@/components/ui-kit";
import { useStore, formatMoney } from "@/lib/store";
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
  const orders = useStore((s) => s.orders);
  const settings = useStore((s) => s.settings);

  const kpis = useMemo(() => {
    const t0 = todayRange().start;
    const paidToday = orders.filter((o) => o.payment === "paid" && (o.paidAt ?? o.createdAt) >= t0);
    const upi = paidToday.filter((o) => o.paymentMethod === "upi").reduce((s, o) => s + o.total, 0);
    const cash = paidToday.filter((o) => o.paymentMethod === "cash").reduce((s, o) => s + o.total, 0);
    return { count: paidToday.length, upi, cash, total: upi + cash };
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's revenue" value={formatMoney(kpis.total, settings.currency)} icon={TrendingUp} tone="success" />
        <StatCard label="Bills settled" value={kpis.count} icon={Receipt} />
        <StatCard label="UPI collected" value={formatMoney(kpis.upi, settings.currency)} icon={Wallet} tone="info" />
        <StatCard label="Cash collected" value={formatMoney(kpis.cash, settings.currency)} icon={Banknote} tone="warning" />
      </div>
      <FloorOps manageTablesHref="/manager/dashboard" />
    </div>
  );
}
