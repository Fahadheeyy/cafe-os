/** Settings (`/owner/settings`). Restaurant name, currency, tax %. */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthGuard } from "@/components/auth-guard";
import { OwnerShell } from "@/components/owner-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

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
  const { business, refresh } = useAuth();
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);

  const [form, setForm] = useState({
    restaurantName: business?.name ?? settings.restaurantName,
    logo: business?.logo ?? settings.logo,
    currency: business?.currency ?? settings.currency,
    taxPercent: business?.tax_percent ?? settings.taxPercent,
    parcelFee: business?.parcel_fee ?? settings.parcelFee,
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (business) {
      setForm({
        restaurantName: business.name,
        logo: business.logo ?? "",
        currency: business.currency,
        taxPercent: business.tax_percent,
        parcelFee: business.parcel_fee,
      });
    }
  }, [business]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (business?.id) {
        const { error } = await supabase
          .from("businesses")
          .update({
            name: form.restaurantName,
            logo: form.logo || null,
            currency: form.currency,
            tax_percent: Number(form.taxPercent),
            parcel_fee: Number(form.parcelFee),
          })
          .eq("id", business.id);
          
        if (error) throw error;
        await refresh();
      }
      
      update({ ...form, taxPercent: Number(form.taxPercent), parcelFee: Number(form.parcelFee) });
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
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
            <div className="space-y-1.5">
              <Label>Parcel Fee</Label>
              <Input type="number" step="0.01" value={form.parcelFee ?? 0} onChange={(e) => setForm({ ...form, parcelFee: Number(e.target.value) })} required />
            </div>
          </div>
          <div className="pt-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
