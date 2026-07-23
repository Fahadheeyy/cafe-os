/**
 * Staff & Chef management (`/owner/staff`). Owners create team accounts,
 * reset passwords, activate / deactivate, or remove members. All writes go
 * through server functions that use the Supabase admin client after
 * verifying the caller is the business owner.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { OwnerShell } from "@/components/owner-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui-kit";
import { useAuth } from "@/hooks/use-auth";
import {
  useMembers,
  useCreateMember,
  useDeleteMember,
  useResetMemberPassword,
  useToggleMemberActive,
} from "@/hooks/use-staff";
import type { StaffRole } from "@/lib/services/staff.service";

export const Route = createFileRoute("/owner/staff")({
  ssr: false,
  component: () => (
    <AuthGuard role="owner">
      <OwnerShell title="Staff">
        <StaffPage />
      </OwnerShell>
    </AuthGuard>
  ),
});

const roleLabel = (r: StaffRole) =>
  r === "owner" ? "Owner" : r === "chef" ? "Chef" : r === "manager" ? "Manager" : "Staff";
const roleBadge = (r: StaffRole) =>
  r === "chef"
    ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
    : r === "manager"
      ? "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200"
      : "";

function StaffPage() {
  const { profile } = useAuth();
  const { data: members = [], isLoading } = useMembers();
  const create = useCreateMember();
  const remove = useDeleteMember();
  const reset = useResetMemberPassword();
  const toggle = useToggleMemberActive();

  const [open, setOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState<string | null>(null);
  const [form, setForm] = useState<{ name: string; email: string; password: string; role: StaffRole }>(
    { name: "", email: "", password: "", role: "staff" },
  );
  const [newPw, setNewPw] = useState("");

  const team = members.filter((m) => m.role !== "owner");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6)
      return toast.error("Fill all fields (password ≥ 6 chars)");
    try {
      await create.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
      toast.success(`${roleLabel(form.role)} added`);
      setForm({ name: "", email: "", password: "", role: "staff" });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add member");
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) return toast.error("Password must be at least 6 characters");
    try {
      await reset.mutateAsync({ userId: resetOpen!, password: newPw });
      toast.success("Password reset");
      setResetOpen(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}?`)) return;
    try {
      await remove.mutateAsync(id);
      toast.success("Removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await toggle.mutateAsync({ userId: id, active });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{team.length} team members</p>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add member</Button>
      </div>

      {isLoading ? (
        <div className="p-10 grid place-items-center text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : team.length === 0 ? (
        <Card className="rounded-2xl">
          <EmptyState icon={Plus} title="No team members yet" description="Add your first staff, manager, or chef to get started." />
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((u) => (
            <Card key={u.id} className="p-5 rounded-2xl border shadow-sm">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-accent text-accent-foreground font-semibold">
                  {u.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge variant="secondary" className={roleBadge(u.role)}>{roleLabel(u.role)}</Badge>
                    <Badge variant={u.active ? "default" : "secondary"} className={u.active ? "bg-primary" : ""}>
                      {u.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Switch checked={u.active} onCheckedChange={(v) => handleToggle(u.id, v)} disabled={u.id === profile?.id} />
                  <span className="text-xs text-muted-foreground">{u.active ? "Enabled" : "Disabled"}</span>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label={`Reset password for ${u.name}`} onClick={() => { setResetOpen(u.id); setNewPw(""); }}>
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={`Remove ${u.name}`} disabled={u.id === profile?.id} onClick={() => handleDelete(u.id, u.name)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add team member</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as StaffRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff — POS & tables</SelectItem>
                  <SelectItem value="manager">Manager — billing & floor</SelectItem>
                  <SelectItem value="chef">Chef — kitchen & stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></div>
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetOpen} onOpenChange={(v) => !v && setResetOpen(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Reset password</DialogTitle></DialogHeader>
          <form onSubmit={submitReset} className="space-y-3">
            <div className="space-y-1.5"><Label>New password</Label><Input value={newPw} onChange={(e) => setNewPw(e.target.value)} required autoFocus minLength={6} /></div>
            <DialogFooter>
              <Button type="submit" disabled={reset.isPending}>
                {reset.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
