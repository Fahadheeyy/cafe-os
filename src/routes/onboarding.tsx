/**
 * Business activation screen for a signed-in user with no business_id yet.
 * Typically only reached when a signup previously failed after the auth user
 * was created but before the RPC could run (e.g. network drop).
 *
 * Also handles the "email confirmed → first login" case: if the user signed
 * up with a pending business name in their metadata, we pre-fill the field.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Coffee, LogOut } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, roleHome } from "@/hooks/use-auth";
import { friendlyAuthError } from "@/lib/auth-errors";
import { notify } from "@/lib/notify";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

const schema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, "Business name must be at least 2 characters")
    .max(80, "Business name is too long"),
});

function OnboardingPage() {
  const { session, loading, profile, role, user, activateBusiness, signOut } = useAuth();
  const navigate = useNavigate();
  const pending = (user?.user_metadata?.pending_business_name as string | undefined) ?? "";
  const [businessName, setBusinessName] = useState(pending);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
    } else if (profile?.business_id) {
      navigate({ to: roleHome(role), replace: true });
    }
  }, [loading, session, profile?.business_id, role, navigate]);

  useEffect(() => {
    if (pending) setBusinessName(pending);
  }, [pending]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    const parsed = schema.safeParse({ businessName });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSubmitting(true);
    try {
      await activateBusiness(parsed.data.businessName);
      notify.success("Your café is ready");
      navigate({ to: "/owner/dashboard", replace: true });
    } catch (err) {
      notify.error(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh grid place-items-center bg-gradient-to-br from-primary/5 via-background to-accent px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md space-y-6" noValidate>
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Coffee className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight">CafeOS</span>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Name your café</h1>
          <p className="text-sm text-muted-foreground mt-1">
            You're signed in as {profile?.email ?? user?.email}. Give your café a name to
            finish setup — we'll create your menu, tables and starter inventory.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="businessName">Business name</Label>
          <Input
            id="businessName"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. Sunrise Coffee House"
            maxLength={80}
            required
            autoFocus
            aria-invalid={!!error}
            aria-describedby={error ? "biz-error" : undefined}
          />
          {error ? (
            <p id="biz-error" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button type="submit" className="h-11 flex-1" disabled={submitting || loading}>
            {submitting ? "Setting up..." : "Create café"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 sm:w-auto gap-2"
            onClick={() => signOut().then(() => navigate({ to: "/login", replace: true }))}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </form>
    </div>
  );
}
