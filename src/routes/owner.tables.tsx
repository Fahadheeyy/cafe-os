/** Table management (`/owner/tables`). Add / rename / delete tables. */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { OwnerShell } from "@/components/owner-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RestaurantTable, TableStatus } from "@/lib/services/tables.service";
import { useCreateTable, useDeleteTable, useRenameTable, useTables } from "@/hooks/use-tables";

export const Route = createFileRoute("/owner/tables")({
  ssr: false,
  component: () => (
    <AuthGuard role="owner">
      <OwnerShell title="Tables">
        <TablesPage />
      </OwnerShell>
    </AuthGuard>
  ),
});

const statusStyle: Record<TableStatus, { dot: string; label: string; ring: string }> = {
  available: { dot: "bg-emerald-500", label: "Available", ring: "ring-emerald-500/20" },
  occupied: { dot: "bg-amber-500", label: "Occupied", ring: "ring-amber-500/20" },
  bill_ready: { dot: "bg-red-500", label: "Bill Ready", ring: "ring-red-500/20" },
};

function TablesPage() {
  const { data: tables = [], isLoading, isError, error, refetch } = useTables();
  const createMut = useCreateTable();
  const renameMut = useRenameTable();
  const deleteMut = useDeleteTable();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [name, setName] = useState("");

  const openNew = () => { setEditing(null); setName(`Table ${tables.length + 1}`); setOpen(true); };
  const openEdit = (t: RestaurantTable) => { setEditing(t); setName(t.name); setOpen(true); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      if (editing) { await renameMut.mutateAsync({ id: editing.id, name: name.trim() }); toast.success("Renamed"); }
      else { await createMut.mutateAsync(name.trim()); toast.success("Table added"); }
      setOpen(false);
    } catch (err: any) { toast.error(err?.message || "Save failed"); }
  };

  const remove = async (t: RestaurantTable) => {
    try { await deleteMut.mutateAsync(t.id); toast.success("Removed"); }
    catch (err: any) { toast.error(err?.message || "Delete failed"); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-xs">
          {(["available", "occupied", "bill_ready"] as TableStatus[]).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${statusStyle[s].dot}`} />
              <span className="text-muted-foreground">{statusStyle[s].label}</span>
            </div>
          ))}
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add table</Button>
      </div>

      {isLoading ? (
        <Card className="p-12 text-center rounded-2xl"><Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" /></Card>
      ) : isError ? (
        <Card className="p-8 text-center rounded-2xl space-y-3">
          <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Could not load tables."}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </Card>
      ) : tables.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground rounded-2xl"><p className="text-sm">No tables yet. Add your first one.</p></Card>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {tables.map((t) => {
            const s = statusStyle[t.status];
            return (
              <Card key={t.id} className={`p-4 rounded-2xl border shadow-sm ring-1 ${s.ring}`}>
                <div className="flex items-start justify-between">
                  <span className={`h-2 w-2 rounded-full ${s.dot} mt-2`} />
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Rename ${t.name}`} onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Delete ${t.name}`} onClick={() => remove(t)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <p className="mt-3 text-lg font-semibold tracking-tight">{t.name}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{editing ? "Rename table" : "Add table"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMut.isPending || renameMut.isPending}>
                {createMut.isPending || renameMut.isPending ? "Saving…" : editing ? "Save" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
