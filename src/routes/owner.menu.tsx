/** Menu management (`/owner/menu`). CRUD for products, search + category filter. */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Loader2, FolderPlus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { OwnerShell } from "@/components/owner-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type Category, type Product } from "@/lib/services/products.service";
import { money } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { useCreateProduct, useDeleteProduct, useProducts, useUpdateProduct } from "@/hooks/use-products";
import { useCategories } from "@/hooks/use-categories";

export const Route = createFileRoute("/owner/menu")({
  ssr: false,
  component: () => (
    <AuthGuard role="owner">
      <OwnerShell title="Menu">
        <MenuPage />
      </OwnerShell>
    </AuthGuard>
  ),
});

function MenuPage() {
  const { business } = useAuth();
  const currency = business?.currency ?? "₹";
  const { data: products = [], isLoading, isError, error, refetch } = useProducts();
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories();
  const createMut = useCreateProduct();
  const updateMut = useUpdateProduct();
  const deleteMut = useDeleteProduct();

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "All">("All");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  
  const defaultCategory = categories[0] ?? "Tea";
  const [form, setForm] = useState({ name: "", category: defaultCategory, price: 0, description: "", available: true });

  // Category Manager dialog state
  const [catOpen, setCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [savingCat, setSavingCat] = useState(false);

  const filtered = useMemo(() => {
    const query = q.toLowerCase();
    return products.filter(
      (p) => (cat === "All" || p.category === cat) && (!query || p.name.toLowerCase().includes(query)),
    );
  }, [products, q, cat]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", category: categories[0] ?? "Tea", price: 0, description: "", available: true });
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, category: p.category, price: p.price, description: p.description ?? "", available: p.available });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.price <= 0) return toast.error("Name and valid price required");
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, patch: form });
        toast.success("Product updated");
      } else {
        await createMut.mutateAsync(form);
        toast.success("Product added");
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  };

  const remove = async (p: Product) => {
    try {
      await deleteMut.mutateAsync(p.id);
      toast.success("Deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const toggleAvailable = async (p: Product, v: boolean) => {
    try { await updateMut.mutateAsync({ id: p.id, patch: { available: v } }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Update failed"); }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      addCategory(newCatName);
      toast.success(`Category "${newCatName.trim()}" added`);
      setNewCatName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add category");
    }
  };

  const handleStartEditCat = (c: string) => {
    setEditingCat(c);
    setEditingCatName(c);
  };

  const handleSaveCat = async (oldName: string) => {
    if (!editingCatName.trim()) return toast.error("Category name required");
    setSavingCat(true);
    try {
      await updateCategory(oldName, editingCatName);
      toast.success(`Category renamed to "${editingCatName.trim()}"`);
      setEditingCat(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename category");
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCat = (c: string) => {
    try {
      deleteCategory(c);
      toast.success(`Category "${c}" deleted`);
      if (cat === c) setCat("All");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete category");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-10" />
        </div>
        <Select value={cat} onValueChange={(v) => setCat(v as Category | "All")}>
          <SelectTrigger className="w-44 h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All categories</SelectItem>
            {categories.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setCatOpen(true)} className="h-10">
          <FolderPlus className="h-4 w-4 mr-1.5" /> Categories
        </Button>
        <Button onClick={openNew} className="h-10 hidden sm:inline-flex">
          <Plus className="h-4 w-4 mr-1" /> Add product
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-12 text-center rounded-2xl">
          <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
        </Card>
      ) : isError ? (
        <Card className="p-8 text-center rounded-2xl space-y-3">
          <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Could not load menu."}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground rounded-2xl">
          <p className="text-sm">{products.length === 0 ? "No products yet. Add your first one." : "No products match your search."}</p>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <Card key={p.id} className="p-4 rounded-2xl shadow-sm border flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                </div>
                <span className="text-sm font-semibold">{money(p.price, currency)}</span>
              </div>
              {p.description ? <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p> : null}
              <div className="flex items-center justify-between pt-2 mt-auto border-t">
                <div className="flex items-center gap-2">
                  <Switch checked={p.available} onCheckedChange={(v) => toggleAvailable(p, v)} />
                  <Badge variant={p.available ? "default" : "secondary"} className={p.available ? "bg-primary" : ""}>
                    {p.available ? "Available" : "Off"}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label={`Edit ${p.name}`} onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={`Delete ${p.name}`} onClick={() => remove(p)} disabled={deleteMut.isPending}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <button
        onClick={openNew}
        className="sm:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg grid place-items-center z-40 active:scale-95 transition"
        aria-label="Add product"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Add / Edit Product Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as Category })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Price</Label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="text-sm font-medium">Available</p>
                <p className="text-xs text-muted-foreground">Toggle visibility in ordering</p>
              </div>
              <Switch checked={form.available} onCheckedChange={(v) => setForm({ ...form, available: v })} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {createMut.isPending || updateMut.isPending ? "Saving…" : editing ? "Save changes" : "Add product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Categories Dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Menu Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Form to add a new category */}
            <form onSubmit={handleAddCategory} className="flex items-center gap-2">
              <Input
                placeholder="New category name..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="h-10 flex-1"
              />
              <Button type="submit" className="h-10 whitespace-nowrap">
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </form>

            {/* List of existing categories */}
            <div className="divide-y border rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              {categories.map((c) => {
                const count = products.filter((p) => p.category === c).length;
                const isEditingThis = editingCat === c;

                return (
                  <div key={c} className="flex items-center justify-between p-3 bg-card hover:bg-muted/40 transition">
                    {isEditingThis ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <Input
                          value={editingCatName}
                          onChange={(e) => setEditingCatName(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveCat(c);
                            } else if (e.key === "Escape") {
                              setEditingCat(null);
                            }
                          }}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-green-600 hover:text-green-700"
                          onClick={() => handleSaveCat(c)}
                          disabled={savingCat}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => setEditingCat(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5">
                          <span className="font-medium text-sm">{c}</span>
                          <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
                            {count} {count === 1 ? "item" : "items"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Edit category"
                            onClick={() => handleStartEditCat(c)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Delete category"
                            onClick={() => handleDeleteCat(c)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

