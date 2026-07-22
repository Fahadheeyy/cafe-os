/**
 * Staff dashboard (`/staff`). Minimal table grid with live status +
 * running bill total; tapping a table opens the POS order screen.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { LogOut, Coffee } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { useStore, type TableStatus } from "@/lib/store";
import { money as formatMoney } from "@/lib/format";
import { useAuth, useCurrentUser } from "@/hooks/use-auth";
import { useTables } from "@/hooks/use-tables";
import { useOrders } from "@/hooks/use-orders";
import { Button } from "@/components/ui/button";
import { playNotificationSound, unlockAudio } from "@/lib/sound";

export const Route = createFileRoute("/staff")({
  ssr: false,
  component: () => (
    <AuthGuard role="staff">
      <StaffHome />
    </AuthGuard>
  ),
});

const statusStyle: Record<TableStatus, { dot: string; label: string; ring: string; bg: string }> = {
  available: { dot: "bg-emerald-500", label: "Available", ring: "ring-emerald-500/30", bg: "bg-emerald-50/50" },
  occupied: { dot: "bg-amber-500", label: "Occupied", ring: "ring-amber-500/30", bg: "bg-amber-50/50" },
  bill_ready: { dot: "bg-red-500", label: "Bill Ready", ring: "ring-red-500/30", bg: "bg-red-50/50" },
};

function StaffHome() {
  const { data: tables = [] } = useTables();
  const { data: orders = [] } = useOrders();
  const settings = useStore((s) => s.settings);
  const user = useCurrentUser();
  const { signOut, business } = useAuth();
  const navigate = useNavigate();
  const displayName = business?.name ?? settings.restaurantName;

  // Track ready KOTs to play audio notification to staff
  const readyKots = useMemo(() => {
    return orders.flatMap((o) =>
      o.kots
        .filter((k) => k.kitchenStatus === "ready")
        .map((k) => ({ ...k, tableName: o.tableName ?? "Table" }))
    );
  }, [orders]);

  const prevReadyIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const currentReadyIds = new Set(readyKots.map((k) => k.id));
    if (prevReadyIdsRef.current !== null) {
      let newlyReadyTable = "";
      for (const k of readyKots) {
        if (!prevReadyIdsRef.current.has(k.id)) {
          newlyReadyTable = k.tableName;
          break;
        }
      }
      if (newlyReadyTable) {
        unlockAudio();
        playNotificationSound("food_ready");
        toast.success(`🍳 Food is ready for ${newlyReadyTable}!`, { duration: 6000 });
      }
    }
    prevReadyIdsRef.current = currentReadyIds;
  }, [readyKots]);

  const billFor = (tableId: string) => {
    const o = orders.find((x) => x.tableId === tableId && x.status === "pending" && x.payment === "unpaid");
    return o?.total ?? 0;
  };

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login", replace: true });
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="h-16 border-b bg-background/80 backdrop-blur sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Coffee className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">{displayName}</p>
            <p className="text-[11px] text-muted-foreground -mt-0.5">Hi, {user?.name}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-1" /> Sign out
        </Button>
      </header>

      <main className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <h1 className="text-xl font-semibold tracking-tight">Tables</h1>
          <p className="text-xs text-muted-foreground">{tables.filter((t) => t.status === "available").length} of {tables.length} available</p>
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <Link
            to="/order/$tableId"
            params={{ tableId: "takeaway" }}
            className={`p-5 rounded-2xl border shadow-sm ring-1 ring-blue-500/30 bg-blue-50/50 active:scale-[0.98] transition text-left`}
          >
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full bg-blue-500`} />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Takeaway</span>
            </div>
            <p className="mt-3 text-xl font-semibold tracking-tight">Parcel Order</p>
            <p className="text-sm text-muted-foreground mt-1">Tap to start</p>
          </Link>
          {tables.map((t) => {
            const s = statusStyle[t.status];
            const bill = billFor(t.id);
            return (
              <Link
                key={t.id}
                to="/order/$tableId"
                params={{ tableId: t.id }}
                className={`p-5 rounded-2xl border shadow-sm ring-1 ${s.ring} ${s.bg} active:scale-[0.98] transition text-left`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
                </div>
                <p className="mt-3 text-xl font-semibold tracking-tight">{t.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t.status === "available" ? "Tap to start" : formatMoney(bill, business?.currency ?? "₹")}
                </p>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
