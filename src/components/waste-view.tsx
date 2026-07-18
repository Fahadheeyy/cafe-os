/**
 * Waste / spoilage log. Recording waste deducts the quantity from
 * stock, writes a `waste` entry into stock history, and estimates the
 * cost using the last purchase rate for that item.
 */
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/store";
import { WASTE_REASONS, type WasteReason, type Unit } from "@/lib/services/inventory.service";
import { useWaste, useStockItems, useRecordWaste, useDeleteWaste } from "@/hooks/use-inventory";
import { useAuth } from "@/hooks/use-auth";

export function WasteView({ canRecord }: { canRecord: boolean }) {
  const { data: waste = [] } = useWaste();
  const { data: items = [] } = useStockItems();
  const { business } = useAuth();
  const currency = business?.currency ?? "INR";
  const recordM = useRecordWaste();
  const deleteM = useDeleteWaste();
  const addWaste = (v: Parameters<typeof recordM.mutateAsync>[0]) => recordM.mutateAsync(v);
  const deleteWaste = (id: string) => deleteM.mutateAsync(id);
  const [open, setOpen] = useState(false);

  const sorted = useMemo(() => [...waste].sort((a, b) => b.createdAt - a.createdAt), [waste]);
  const totalCost = sorted.reduce((s, w) => s + w.estimatedCost, 0);
  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? "Unknown";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <Card className="p-4 rounded-2xl flex items-center gap-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Entries</p>
            <p className="text-xl font-semibold">{sorted.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Estimated Cost</p>
            <p className="text-xl font-semibold text-red-600">{formatMoney(totalCost, currency)}</p>
          </div>
        </Card>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Record Waste</Button>
          </DialogTrigger>
          <WasteForm onDone={(v) => { addWaste(v); toast.success("Waste recorded"); setOpen(false); }} />
        </Dialog>
      </div>

      {sorted.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground rounded-2xl">
          No waste recorded. Nothing to worry about.
        </Card>
      ) : (
        <div className="grid gap-2">
          {sorted.map((w) => (
            <Card key={w.id} className="p-4 rounded-xl flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{itemName(w.stockItemId)}</p>
                  <Badge variant="secondary">{w.reason}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {w.quantity} {w.unit} · {w.reportedByName} · {new Date(w.createdAt).toLocaleString()}
                </p>
                {w.notes && <p className="text-xs italic mt-1 text-muted-foreground">"{w.notes}"</p>}
              </div>
              <span className="font-semibold text-red-600">-{formatMoney(w.estimatedCost, currency)}</span>
              {canRecord && (
                <Button variant="ghost" size="sm" aria-label="Delete waste entry" onClick={() => { if (confirm("Delete entry?")) { deleteWaste(w.id); toast.success("Deleted"); } }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function WasteForm({ onDone }: {
  onDone: (v: { stockItemId: string; quantity: number; unit: Unit; reason: WasteReason; notes?: string }) => void;
}) {
  const { data: items = [] } = useStockItems();
  const [stockItemId, setId] = useState(items[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<WasteReason>("Spillage");
  const [notes, setNotes] = useState("");
  const selected = items.find((i) => i.id === stockItemId);

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Record Waste</DialogTitle></DialogHeader>
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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Quantity ({selected?.unit})</Label>
            <Input type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as WasteReason)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WASTE_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={() => {
            if (!selected || !Number(qty)) { toast.error("Item and quantity required"); return; }
            onDone({ stockItemId, quantity: Number(qty), unit: selected.unit, reason, notes: notes.trim() || undefined });
          }}
        >Save</Button>
      </DialogFooter>
    </DialogContent>
  );
}
