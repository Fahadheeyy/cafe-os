/**
 * Sign-in screen. Authenticates against Supabase Auth. Once signed in, the
 * component watches the auth context and redirects the user to onboarding
 * (if they have no business) or their role's home dashboard.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Coffee } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, roleHome } from "@/hooks/use-auth";
import { friendlyAuthError } from "@/lib/auth-errors";
import { notify } from "@/lib/notify";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(254),
  password: z.string().min(1, "Password is required").max(128),
});

function LoginPage() {
  const { signIn, session, loading, profile, role } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading || !session) return;
    if (!profile?.business_id) {
      navigate({ to: "/onboarding", replace: true });
    } else if (role) {
      navigate({ to: roleHome(role), replace: true });
    }
  }, [loading, session, profile?.business_id, role, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const parsed = loginSchema.parse({ email, password });
      await signIn(parsed.email, parsed.password);
      notify.success("Welcome back");
    } catch (err) {
      notify.error(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary/10 via-accent to-background">
        <div className="flex items-center gap-2 text-foreground">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Coffee className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight">CafeOS</span>
        </div>
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground leading-tight">
            The fastest way to run your café.
          </h1>
          <p className="mt-4 text-muted-foreground max-w-md">
            Take an order in under 10 seconds. Beautiful, minimal, built for touch.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© CafeOS</p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6" noValidate>
          <div className="lg:hidden flex items-center gap-2 mb-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Coffee className="h-5 w-5" />
            </div>
            <span className="font-semibold tracking-tight">CafeOS</span>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-1">Welcome back. Enter your details.</p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={128}
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-11" disabled={submitting || loading}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            New to CafeOS?{" "}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Create your café
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
