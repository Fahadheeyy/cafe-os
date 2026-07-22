/**
 * Expense management (`/owner/expenses`). CRUD for non-purchase expenses
 * (rent, salary, gas, …). Feeds into the dashboard profit calc.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { OwnerShell } from "@/components/owner-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/store";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/services/inventory.service";
import { useExpenses, useCreateExpense, useDeleteExpense } from "@/hooks/use-inventory";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/owner/expenses")({
  ssr: false,
  component: () => (
    <AuthGuard role="owner">
      <OwnerShell title="Expenses">
        <Expenses />
      </OwnerShell>
    </AuthGuard>
  ),
});

function Expenses() {
  const { data: expenses = [] } = useExpenses();
  const addExpenseM = useCreateExpense();
  const deleteExpenseM = useDeleteExpense();
  const addExpense = (v: Parameters<typeof addExpenseM.mutateAsync>[0]) => addExpenseM.mutateAsync(v);
  const deleteExpense = (id: string) => deleteExpenseM.mutateAsync(id);
  const { business } = useAuth();
  const currency = business?.currency ?? "INR";

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return expenses
      .filter((e) => cat === "all" || e.category === cat)
      .filter((e) => (ql ? e.title.toLowerCase().includes(ql) : true))
      .sort((a, b) => b.expenseDate - a.expenseDate);
  }, [expenses, q, cat]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search title" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Add Expense</Button>
          </DialogTrigger>
          <ExpenseForm onDone={() => setOpen(false)} onSubmit={(v) => { addExpense(v); toast.success("Expense added"); setOpen(false); }} />
        </Dialog>
      </div>

      <Card className="p-4 rounded-2xl flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{filtered.length} entries</span>
        <span className="text-lg font-semibold">{formatMoney(total, currency)}</span>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground rounded-2xl">No expenses recorded.</Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((e) => (
            <Card key={e.id} className="p-4 rounded-xl flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{e.title}</p>
                  <Badge variant="secondary" className="text-[10px]">{e.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(e.expenseDate).toLocaleDateString()} {e.notes ? `· ${e.notes}` : ""}
                </p>
              </div>
              <span className="font-semibold">{formatMoney(e.amount, currency)}</span>
              <Button variant="ghost" size="sm" aria-label="Delete expense" onClick={() => { if (confirm("Delete this expense?")) { deleteExpense(e.id); toast.success("Deleted"); } }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ExpenseForm({ onSubmit }: {
  onDone: () => void;
  onSubmit: (v: { title: string; category: ExpenseCategory; amount: number; notes?: string; expenseDate: number }) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("Miscellaneous");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. October Rent" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
            if (!title.trim() || !Number(amount)) { toast.error("Title and amount required"); return; }
            onSubmit({
              title: title.trim(), category, amount: Number(amount),
              notes: notes.trim() || undefined, expenseDate: new Date(date + "T00:00:00").getTime(),
            });
          }}
        >Save</Button>
      </DialogFooter>
    </DialogContent>
  );
}
