/** Settings (`/owner/settings`). Restaurant name, currency, tax %. */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { OwnerShell } from "@/components/owner-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/owner/settings")({
  ssr: false,
  component: () => (
    <AuthGuard role="owner">
      <OwnerShell title="Settings">
        <SettingsPage />
      </OwnerShell>
    </AuthGuard>
  ),
});

function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const [form, setForm] = useState(settings);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    update({ ...form, taxPercent: Number(form.taxPercent) });
    toast.success("Settings saved");
  };

  return (
    <div className="max-w-2xl">
      <Card className="p-6 rounded-2xl border shadow-sm">
        <h2 className="text-base font-semibold">Restaurant profile</h2>
        <p className="text-sm text-muted-foreground mt-1">Basic details shown across the app and on receipts.</p>
        <form onSubmit={save} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label>Restaurant name</Label>
            <Input value={form.restaurantName} onChange={(e) => setForm({ ...form, restaurantName: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>Logo URL (optional)</Label>
            <Input value={form.logo ?? ""} onChange={(e) => setForm({ ...form, logo: e.target.value })} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Currency symbol</Label>
              <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Tax %</Label>
              <Input type="number" step="0.01" value={form.taxPercent} onChange={(e) => setForm({ ...form, taxPercent: Number(e.target.value) })} required />
            </div>
          </div>
          <div className="pt-2">
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
