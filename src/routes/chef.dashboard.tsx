/**
 * Chef Dashboard (`/chef/dashboard`). Live Kitchen Display with FIFO
 * queue backed by Supabase Realtime.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { Package, Inbox, Trash2, ArrowRight, ChefHat, CheckCircle2, Clock, Utensils, Loader2, NotebookPen, FileText, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { ChefShell } from "@/components/chef-shell";
import { StatCard, SectionCard, EmptyState, StatusPill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { useOrders, useSetKitchenStatus } from "@/hooks/use-orders";
import type { KitchenStatus } from "@/lib/services/orders.service";
import { playNotificationSound, unlockAudio } from "@/lib/sound";

export const Route = createFileRoute("/chef/dashboard")({
  ssr: false,
  component: () => (
    <AuthGuard role="chef">
      <ChefShell title="Kitchen">
        <ChefDashboard />
      </ChefShell>
    </AuthGuard>
  ),
});

function minsAgo(ts: number) {
  const m = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (m < 1) return "just now";
  if (m === 1) return "1 min ago";
  return `${m} min ago`;
}

function ChefDashboard() {
  const { business } = useAuth();
  const currency = business?.currency ?? "₹";
  const { data: orders = [], isLoading, isError, error, refetch } = useOrders();

  const setKitchen = useSetKitchenStatus();

  const allKots = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status === "pending" && o.items.length > 0);
    return activeOrders.flatMap((o) =>
      o.kots.map((k) => ({
        ...k,
        tableName: o.tableName,
        staffName: o.staffName,
        orderNotes: o.notes,
        kotTotal: k.items.reduce((sum, i) => sum + i.price * i.qty, 0),
      }))
    ).filter((k) => k.items.length > 0 && k.kitchenStatus !== "served");
  }, [orders]);

  const queue = useMemo(() => {
    return allKots
      .filter((k) => k.kitchenStatus === "queued" || k.kitchenStatus === "preparing")
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [allKots]);

  const ready = useMemo(() => {
    return allKots
      .filter((k) => k.kitchenStatus === "ready")
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [allKots]);

  // Play audio chime and toast notification when new orders arrive in queue
  const prevKotIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const currentIds = new Set(queue.map((k) => k.id));
    if (prevKotIdsRef.current !== null) {
      let hasNewTicket = false;
      for (const id of currentIds) {
        if (!prevKotIdsRef.current.has(id)) {
          hasNewTicket = true;
          break;
        }
      }
      if (hasNewTicket) {
        unlockAudio();
        playNotificationSound("new_order");
        toast.info("🔔 New order received in kitchen!", { duration: 5000 });
      }
    }
    prevKotIdsRef.current = currentIds;
  }, [queue]);

  const handleTestSound = () => {
    unlockAudio();
    playNotificationSound("new_order");
    toast.success("🔔 Sound alert test played!", { duration: 3000 });
  };

  const kpis: Array<{ label: string; value: number; tone?: "success" | "warning" | "danger" | "info" }> = [
    { label: "In queue", value: queue.filter((k) => k.kitchenStatus === "queued").length, tone: "info" },
    { label: "Preparing", value: queue.filter((k) => k.kitchenStatus === "preparing").length, tone: "warning" },
    { label: "Ready to serve", value: ready.length, tone: ready.length ? "success" : undefined },
    { label: "Active tickets", value: allKots.length },
  ];

  const advance = async (id: string, to: KitchenStatus) => {
    try { await setKitchen.mutateAsync({ kotId: id, status: to }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Could not update ticket"); }
  };

  if (isLoading) {
    return <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (isError) {
    return (
      <div className="p-8 rounded-2xl border text-center space-y-3">
        <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Could not load kitchen queue."}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => <StatCard key={k.label} label={k.label} value={k.value} tone={k.tone} />)}
      </div>

      <SectionCard
        title="Kitchen queue"
        icon={ChefHat}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleTestSound} className="h-8 text-xs gap-1.5 border-primary/30 hover:bg-primary/10">
              <Volume2 className="h-3.5 w-3.5 text-primary" /> Test Sound
            </Button>
            <span className="text-xs text-muted-foreground hidden sm:inline">FIFO · oldest first</span>
          </div>
        }
      >
        {queue.length === 0 ? (
          <EmptyState compact icon={Utensils} description="No tickets waiting. Nice work." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {queue.map((k, idx) => {
              const isPrep = k.kitchenStatus === "preparing";
              return (
                <div key={k.id} className={`p-4 rounded-2xl border-2 ${isPrep ? "border-amber-400 bg-amber-50/40" : "border-primary/40 bg-primary/5"}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-foreground text-background">#{idx + 1}</span>
                        <p className="font-semibold truncate">{k.tableName}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {minsAgo(k.createdAt)} · {k.staffName}
                      </p>
                    </div>
                    <StatusPill tone={isPrep ? "warning" : "info"}>{isPrep ? "Preparing" : "Queued"}</StatusPill>
                  </div>

                  {/* Order-level Note */}
                  {k.orderNotes && (
                    <div className="mb-2 p-2 rounded-lg bg-amber-100/80 border border-amber-300 text-amber-950 text-xs flex items-start gap-1.5">
                      <NotebookPen className="h-3.5 w-3.5 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Kitchen Note: </span>
                        <span>{k.orderNotes}</span>
                      </div>
                    </div>
                  )}

                  <ul className="text-sm space-y-1 border-t pt-2 mb-3">
                    {k.items.map((i, itemIdx) => (
                      <li key={i.productId ?? itemIdx} className="space-y-0.5">
                        <div className="flex justify-between gap-2">
                          <span className="font-medium"><span className="font-bold text-primary">×{i.qty}</span> {i.name}</span>
                        </div>
                        {i.notes && (
                          <p className="text-[11px] text-amber-800 font-medium italic flex items-center gap-1 pl-4">
                            <FileText className="h-3 w-3 shrink-0 text-amber-600" /> Note: {i.notes}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    {k.kitchenStatus === "queued" ? (
                      <Button size="sm" className="flex-1 min-h-11" onClick={() => advance(k.id, "preparing")}>Start preparing</Button>
                    ) : (
                      <Button size="sm" className="flex-1 min-h-11 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => advance(k.id, "ready")}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Mark ready
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {ready.length > 0 && (
        <SectionCard title="Ready to serve" icon={CheckCircle2}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ready.map((k) => (
              <div key={k.id} className="p-3 rounded-xl border bg-emerald-50/60 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{k.tableName}</p>
                  <p className="text-xs text-muted-foreground">{k.items.length} items · {money(k.kotTotal, currency)}</p>
                </div>
                <Button size="sm" variant="outline" className="min-h-10 shrink-0" onClick={() => advance(k.id, "served")}>Served</Button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { to: "/chef/stock", label: "Update Stock", icon: Package },
          { to: "/chef/requests", label: "Purchase Requests", icon: Inbox },
          { to: "/chef/waste", label: "Log Waste", icon: Trash2 },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.to} to={t.to} className="p-4 rounded-2xl border bg-card shadow-sm hover:border-primary/50 hover:shadow-md transition group flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shrink-0"><Icon className="h-4 w-4" /></div>
              <p className="font-semibold flex-1">{t.label}</p>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
