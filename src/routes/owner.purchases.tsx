/**
 * Purchase entry (`/owner/purchases`). Records supplier invoices with
 * itemised lines; the store auto-updates stock balances, stock history,
 * and creates a matching expense entry.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, Search, Receipt } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { OwnerShell } from "@/components/owner-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui-kit";
import { formatMoney } from "@/lib/store";
import type { PurchaseLine } from "@/lib/services/inventory.service";
import {
  usePurchases, useSuppliers, useStockItems, useRecordPurchase, useDeletePurchase,
} from "@/hooks/use-inventory";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/owner/purchases")({
  ssr: false,
  component: () => (
    <AuthGuard role="owner">
      <OwnerShell title="Purchases">
        <Purchases />
      </OwnerShell>
    </AuthGuard>
  ),
});

function Purchases() {
  const { data: purchases = [] } = usePurchases();
  const { business } = useAuth();
  const currency = business?.currency ?? "INR";
  const { data: suppliers = [] } = useSuppliers();
  const deleteM = useDeletePurchase();
  const deletePurchase = (id: string) => deleteM.mutateAsync(id);
  const [q, setQ] = useState("");
  const [supplier, setSupplier] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return purchases
      .filter((p) => supplier === "all" || p.supplier === supplier)
      .filter((p) =>
        ql ? p.supplier.toLowerCase().includes(ql) || (p.invoiceNumber ?? "").toLowerCase().includes(ql) : true,
      )
      .sort((a, b) => b.purchaseDate - a.purchaseDate);
  }, [purchases, q, supplier]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search supplier or invoice" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={supplier} onValueChange={setSupplier}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Supplier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {suppliers.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New Purchase</Button>
          </DialogTrigger>
          <NewPurchaseForm onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      {filtered.length === 0 ? (
        <Card className="rounded-2xl">
          <EmptyState icon={Receipt} description="No purchases recorded yet." />
        </Card>
      ) : (
        <Card className="rounded-2xl overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-accent/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Supplier</th>
                  <th className="text-left px-4 py-3">Invoice</th>
                  <th className="text-left px-4 py-3">Items</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-accent/20">
                    <td className="px-4 py-3">{new Date(p.purchaseDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium">{p.supplier}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.invoiceNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.items.length} items</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatMoney(p.total, currency)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" aria-label="Delete purchase" onClick={() => { if (confirm("Delete this purchase? Stock will not be reversed.")) { deletePurchase(p.id); toast.success("Deleted"); } }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y">
            {filtered.map((p) => (
              <div key={p.id} className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{p.supplier}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(p.purchaseDate).toLocaleDateString()} · {p.items.length} items
                    {p.invoiceNumber ? ` · #${p.invoiceNumber}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="font-semibold text-sm">{formatMoney(p.total, currency)}</span>
                  <Button variant="ghost" size="sm" className="h-7 px-2" aria-label="Delete purchase" onClick={() => { if (confirm("Delete this purchase? Stock will not be reversed.")) { deletePurchase(p.id); toast.success("Deleted"); } }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function NewPurchaseForm({ onDone }: { onDone: () => void }) {
  const { data: items = [] } = useStockItems();
  const { data: suppliers = [] } = useSuppliers();
  const recordM = useRecordPurchase();
  const record = (v: Parameters<typeof recordM.mutateAsync>[0]) => recordM.mutateAsync(v);
  const { business } = useAuth();
  const currency = business?.currency ?? "INR";

  const [supplier, setSupplier] = useState(suppliers[0] ?? "");
  const [newSupplier, setNewSupplier] = useState("");
  const [invoice, setInvoice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [tax, setTax] = useState("0");
  const [lines, setLines] = useState<PurchaseLine[]>([]);

  const addLine = () => {
    const first = items[0];
    if (!first) return;
    setLines((ls) => [...ls, { stockItemId: first.id, name: first.name, quantity: 1, unit: first.unit, rate: 0, total: 0 }]);
  };
  const updateLine = (idx: number, patch: Partial<PurchaseLine>) =>
    setLines((ls) =>
      ls.map((l, i) => {
        if (i !== idx) return l;
        const merged = { ...l, ...patch };
        if (patch.stockItemId) {
          const it = items.find((x) => x.id === patch.stockItemId);
          if (it) { merged.name = it.name; merged.unit = it.unit; }
        }
        merged.total = (Number(merged.quantity) || 0) * (Number(merged.rate) || 0);
        return merged;
      }),
    );
  const removeLine = (idx: number) => setLines((ls) => ls.filter((_, i) => i !== idx));

  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const taxAmt = Number(tax) || 0;
  const grand = subtotal + taxAmt;

  const submit = () => {
    const sup = newSupplier.trim() || supplier;
    if (!sup) { toast.error("Supplier required"); return; }
    if (lines.length === 0) { toast.error("Add at least one item"); return; }
    
    record({
      supplier: sup,
      invoiceNumber: invoice.trim() || undefined,
      purchaseDate: new Date(date).getTime(),
      items: lines,
      tax: taxAmt,
    });
    toast.success("Purchase recorded");
    onDone();
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>New Purchase</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Supplier</Label>
            <Select value={supplier} onValueChange={setSupplier}>
              <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="mt-1.5" placeholder="Or new supplier name" value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Invoice Number</Label>
            <Input value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label>Purchase Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tax ({currency})</Label>
            <Input type="number" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>Items</Label>
            <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus className="h-3 w-3 mr-1" /> Add</Button>
          </div>
          {lines.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No items added.</p>}
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end p-3 rounded-lg border">
              <div className="col-span-2 sm:col-span-4">
                <Select value={l.stockItemId ?? ""} onValueChange={(v) => updateLine(i, { stockItemId: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Input className="h-9" type="number" step="0.01" placeholder="Qty" value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} />
              </div>
              <div className="sm:col-span-1 text-xs text-muted-foreground text-center pb-2 hidden sm:block">{l.unit}</div>
              <div className="sm:col-span-2">
                <Input className="h-9" type="number" step="0.01" placeholder={`Rate (${l.unit})`} value={l.rate} onChange={(e) => updateLine(i, { rate: Number(e.target.value) })} />
              </div>
              <div className="sm:col-span-2 text-right text-sm font-medium pb-2">{formatMoney(l.total, currency)}</div>
              <div className="sm:col-span-1 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => removeLine(i)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border p-4 space-y-1 bg-accent/30">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatMoney(subtotal, currency)}</span></div>
          <div className="flex justify-between text-sm"><span>Tax</span><span>{formatMoney(taxAmt, currency)}</span></div>
          <div className="flex justify-between font-semibold text-base border-t pt-2 mt-2"><span>Grand Total</span><span>{formatMoney(grand, currency)}</span></div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit}>Save Purchase</Button>
      </DialogFooter>
    </DialogContent>
  );
}
