/**
 * Shared stock manager view used by both owner and chef routes. Owners
 * get full CRUD; chefs get "Update Balance" only. Traffic-light health
 * chip driven by `stockStatus` from the store.
 */
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2, Pencil, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  stockStatus, STOCK_CATEGORIES, UNITS,
  type StockItem, type StockCategory, type Unit,
} from "@/lib/services/inventory.service";
import {
  useStockItems, useStockHistory,
  useCreateStockItem, useUpdateStockItem, useDeleteStockItem, useSetStockBalance,
} from "@/hooks/use-inventory";

const statusUi: Record<ReturnType<typeof stockStatus>, { dot: string; label: string; ring: string; text: string }> = {
  sufficient: { dot: "bg-emerald-500", label: "Sufficient", ring: "ring-emerald-500/20", text: "text-emerald-600" },
  low: { dot: "bg-amber-500", label: "Running Low", ring: "ring-amber-500/20", text: "text-amber-600" },
  critical: { dot: "bg-red-500", label: "Purchase Required", ring: "ring-red-500/20", text: "text-red-600" },
};

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function StockManager({ canEdit }: { canEdit: boolean }) {
  const { data: items = [] } = useStockItems();
  const { data: history = [] } = useStockHistory();
  const addStockItemM = useCreateStockItem();
  const updateStockItemM = useUpdateStockItem();
  const deleteStockItemM = useDeleteStockItem();
  const setStockBalanceM = useSetStockBalance();
  const addStockItem = (v: Parameters<typeof addStockItemM.mutateAsync>[0]) => addStockItemM.mutateAsync(v);
  const updateStockItem = (id: string, patch: Parameters<typeof updateStockItemM.mutateAsync>[0]["patch"]) =>
    updateStockItemM.mutateAsync({ id, patch });
  const deleteStockItem = (id: string) => deleteStockItemM.mutateAsync(id);
  const setStockBalance = (id: string, newBalance: number, note?: string) =>
    setStockBalanceM.mutateAsync({ id, newBalance, note });

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<StockCategory | "all">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [updateItem, setUpdateItem] = useState<StockItem | null>(null);
  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [historyItem, setHistoryItem] = useState<StockItem | null>(null);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return items
      .filter((i) => (cat === "all" ? true : i.category === cat))
      .filter((i) => (ql ? i.name.toLowerCase().includes(ql) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, q, cat]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search stock" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={cat} onValueChange={(v) => setCat(v as StockCategory | "all")}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {STOCK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {canEdit && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
            </DialogTrigger>
            <ItemForm
              title="Add Stock Item"
              onSubmit={(v) => { addStockItem(v); toast.success("Item added"); setAddOpen(false); }}
            />
          </Dialog>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground rounded-2xl">No stock items found.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((it) => {
            const s = statusStatus(it);
            return (
              <Card key={it.id} className={`p-5 rounded-2xl shadow-sm border ring-1 ${s.ring}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{it.category}</p>
                    <h3 className="text-base font-semibold truncate mt-0.5">{it.name}</h3>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${s.text}`}>
                    <span className={`h-2 w-2 rounded-full ${s.dot}`} /> {s.label}
                  </span>
                </div>
                <p className="mt-4 text-2xl font-semibold tracking-tight">
                  {it.currentBalance} <span className="text-sm font-normal text-muted-foreground">{it.unit}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">Min {it.minimumBalance} {it.unit} · Updated {timeAgo(it.updatedAt)}</p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => setUpdateItem(it)}>Update</Button>
                  <Button size="sm" variant="ghost" aria-label={`History for ${it.name}`} onClick={() => setHistoryItem(it)}><History className="h-4 w-4" /></Button>
                  {canEdit && (
                    <>
                      <Button size="sm" variant="ghost" aria-label={`Edit ${it.name}`} onClick={() => setEditItem(it)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" aria-label={`Delete ${it.name}`} onClick={() => { if (confirm(`Delete ${it.name}?`)) { deleteStockItem(it.id); toast.success("Deleted"); } }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Update balance dialog */}
      <Dialog open={!!updateItem} onOpenChange={(o) => !o && setUpdateItem(null)}>
        {updateItem && (
          <UpdateBalanceForm
            item={updateItem}
            onSubmit={(bal, note) => {
              setStockBalance(updateItem.id, bal, note);
              toast.success("Stock updated");
              setUpdateItem(null);
            }}
          />
        )}
      </Dialog>

      {/* Edit item dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        {editItem && (
          <ItemForm
            title="Edit Stock Item"
            initial={editItem}
            onSubmit={(v) => { updateStockItem(editItem.id, v); toast.success("Item updated"); setEditItem(null); }}
          />
        )}
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!historyItem} onOpenChange={(o) => !o && setHistoryItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{historyItem?.name} · History</DialogTitle></DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {history.filter((h) => h.stockItemId === historyItem?.id).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No history yet.</p>
            ) : (
              history.filter((h) => h.stockItemId === historyItem?.id).map((h) => (
                <div key={h.id} className="p-3 rounded-xl border text-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-medium capitalize">{h.kind}</span>
                    <span className="text-xs text-muted-foreground">{new Date(h.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {h.previousBalance} → {h.newBalance} · by {h.updatedByName}
                  </p>
                  {h.note && <p className="text-xs mt-1 italic">"{h.note}"</p>}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function statusStatus(it: StockItem) { return statusUi[stockStatus(it)]; }

function ItemForm({ title, initial, onSubmit }: {
  title: string;
  initial?: StockItem;
  onSubmit: (v: { name: string; category: StockCategory; currentBalance: number; unit: Unit; minimumBalance: number }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<StockCategory>(initial?.category ?? "Groceries");
  const [currentBalance, setCB] = useState(String(initial?.currentBalance ?? 0));
  const [unit, setUnit] = useState<Unit>(initial?.unit ?? "kg");
  const [minimumBalance, setMB] = useState(String(initial?.minimumBalance ?? 0));

  useEffect(() => {
    setName(initial?.name ?? "");
    setCategory(initial?.category ?? "Groceries");
    setCB(String(initial?.currentBalance ?? 0));
    setUnit(initial?.unit ?? "kg");
    setMB(String(initial?.minimumBalance ?? 0));
  }, [initial]);

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as StockCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STOCK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Unit</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Current Balance</Label>
            <Input type="number" step="0.01" value={currentBalance} onChange={(e) => setCB(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Minimum</Label>
            <Input type="number" step="0.01" value={minimumBalance} onChange={(e) => setMB(e.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={() => {
            if (!name.trim()) { toast.error("Name required"); return; }
            onSubmit({ name: name.trim(), category, currentBalance: Number(currentBalance) || 0, unit, minimumBalance: Number(minimumBalance) || 0 });
          }}
        >Save</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function UpdateBalanceForm({ item, onSubmit }: { item: StockItem; onSubmit: (bal: number, note?: string) => void }) {
  const [bal, setBal] = useState(String(item.currentBalance));
  const [note, setNote] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Update {item.name}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="rounded-xl border p-4 bg-accent/40">
          <p className="text-xs text-muted-foreground">Current Balance</p>
          <p className="text-2xl font-semibold">{item.currentBalance} {item.unit}</p>
        </div>
        <div className="space-y-1.5">
          <Label>New Balance ({item.unit})</Label>
          <Input type="number" step="0.01" value={bal} onChange={(e) => setBal(e.target.value)} autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label>Note (optional)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Morning usage" rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit(Number(bal) || 0, note.trim() || undefined)}>Save</Button>
      </DialogFooter>
    </DialogContent>
  );
}
