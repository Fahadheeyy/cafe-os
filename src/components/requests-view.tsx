/**
 * Purchase requests: chef submits an item + qty + priority; owner
 * approves / rejects. Approved requests remain listed for reference
 * until the owner records the matching purchase.
 */
import { useMemo, useState } from "react";
import { Plus, Check, X, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Priority, RequestStatus, Unit } from "@/lib/services/inventory.service";
import {
  usePurchaseRequests, useStockItems,
  useSetRequestStatus, useCreatePurchaseRequest,
} from "@/hooks/use-inventory";

const priorityUi: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  high: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

export function RequestsView({ role }: { role: "owner" | "chef" }) {
  const { data: requests = [] } = usePurchaseRequests();
  const { data: items = [] } = useStockItems();
  const setStatusM = useSetRequestStatus();
  const createM = useCreatePurchaseRequest();
  const setStatus = (id: string, status: RequestStatus) => setStatusM.mutateAsync({ id, status });
  const create = (v: Parameters<typeof createM.mutateAsync>[0]) => createM.mutateAsync(v);
  const [tab, setTab] = useState<RequestStatus | "all">("pending");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const list = tab === "all" ? requests : requests.filter((r) => r.status === tab);
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [requests, tab]);

  const findItem = (id: string) => items.find((i) => i.id === id);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="-mx-1 px-1 overflow-x-auto">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="purchased">Purchased</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {role === "chef" && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="sm:w-auto w-full"><Plus className="h-4 w-4 mr-1" /> New Request</Button>
            </DialogTrigger>
            <NewRequestForm
              onSubmit={async (v) => { 
                try {
                  await create(v); 
                  toast.success("Request submitted"); 
                  setOpen(false); 
                } catch (err: any) {
                  toast.error(err.message || "Failed to create request");
                }
              }}
            />
          </Dialog>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground rounded-2xl">No requests here.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => {
            const it = findItem(r.stockItemId);
            return (
              <Card key={r.id} className="p-5 rounded-2xl shadow-sm border">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{it?.name ?? "Unknown item"}</h3>
                    <p className="text-xs text-muted-foreground">
                      Current: {it?.currentBalance ?? 0} {r.unit}
                    </p>
                  </div>
                  <Badge className={priorityUi[r.priority]} variant="secondary">{r.priority}</Badge>
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-tight">
                  {r.requestedQuantity} <span className="text-sm font-normal text-muted-foreground">{r.unit}</span>
                </p>
                {r.notes && <p className="text-xs mt-2 text-muted-foreground italic">"{r.notes}"</p>}
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>By {r.requestedByName}</span>
                  <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 items-center">
                  <Badge variant={r.status === "pending" ? "secondary" : "default"} className={
                    r.status === "purchased" ? "bg-emerald-500" :
                    r.status === "approved" ? "bg-primary" :
                    r.status === "rejected" ? "bg-red-500" : ""
                  }>{r.status}</Badge>
                  {role === "owner" && r.status !== "purchased" && r.status !== "rejected" && (
                    <div className="ml-auto flex gap-1.5">
                      {r.status === "pending" && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => { setStatus(r.id, "approved"); toast.success("Approved"); }}>
                            <Check className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="ghost" aria-label="Reject request" onClick={() => { setStatus(r.id, "rejected"); toast("Rejected"); }}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button size="sm" onClick={() => { setStatus(r.id, "purchased"); toast.success("Marked as purchased"); }}>
                        <ShoppingBag className="h-4 w-4 mr-1" /> Purchased
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewRequestForm({ onSubmit }: {
  onSubmit: (v: { stockItemId: string; requestedQuantity: number; unit: Unit; priority: Priority; notes?: string }) => void;
}) {
  const { data: items = [] } = useStockItems();
  const [stockItemId, setId] = useState(items[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [notes, setNotes] = useState("");
  const selected = items.find((i) => i.id === stockItemId);

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New Purchase Request</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Item</Label>
          <Select value={stockItemId} onValueChange={setId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.currentBalance} {i.unit})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {selected && (
          <div className="rounded-lg border p-3 text-xs bg-accent/40">
            Current Balance: <span className="font-semibold">{selected.currentBalance} {selected.unit}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Requested Quantity</Label>
            <Input type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={() => {
            if (!selected || !Number(qty)) { toast.error("Select item and quantity"); return; }
            onSubmit({ stockItemId, requestedQuantity: Number(qty), unit: selected.unit, priority, notes: notes.trim() || undefined });
          }}
        >Submit Request</Button>
      </DialogFooter>
    </DialogContent>
  );
}
