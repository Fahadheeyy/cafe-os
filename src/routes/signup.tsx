/**
 * Public Owner signup. Creates the Supabase Auth user, then calls the
 * `create_business_and_owner` RPC to spin up a new business tenant with
 * default menu/tables/stock. On success the user is signed in and sent to
 * the Owner dashboard.
 *
 * Only the very first user of a business signs up this way. Subsequent
 * staff members must be added by the Owner from the Staff page.
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

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

const signupSchema = z
  .object({
    businessName: z
      .string()
      .trim()
      .min(2, "Business name must be at least 2 characters")
      .max(80, "Business name is too long"),
    name: z.string().trim().min(2, "Your name is required").max(80),
    email: z.string().trim().email("Enter a valid email address").max(254),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password is too long"),
    confirm: z.string().min(1, "Please confirm your password"),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

function SignupPage() {
  const { signUpOwner, session, loading, profile, role } = useAuth();
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading || !session) return;
    if (profile?.business_id && role) {
      navigate({ to: roleHome(role), replace: true });
    }
  }, [loading, session, profile?.business_id, role, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrors({});
    const parsed = signupSchema.safeParse({ businessName, name, email, password, confirm });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "form";
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      await signUpOwner({
        businessName: parsed.data.businessName,
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
      });
      notify.success("Welcome to CafeOS");
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
            Launch your café in under a minute.
          </h1>
          <p className="mt-4 text-muted-foreground max-w-md">
            We'll set up your menu, tables and starter inventory so you can take your first
            order right away.
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
            <h2 className="text-2xl font-semibold tracking-tight">Create your café</h2>
            <p className="text-sm text-muted-foreground mt-1">
              You'll be the Owner. Add staff later from the dashboard.
            </p>
          </div>

          <div className="space-y-3">
            <Field
              id="businessName"
              label="Business name"
              value={businessName}
              onChange={setBusinessName}
              placeholder="e.g. Sunrise Coffee House"
              autoComplete="organization"
              error={errors.businessName}
              maxLength={80}
            />
            <Field
              id="name"
              label="Your name"
              value={name}
              onChange={setName}
              autoComplete="name"
              error={errors.name}
              maxLength={80}
            />
            <Field
              id="email"
              type="email"
              label="Email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              error={errors.email}
              maxLength={254}
            />
            <Field
              id="password"
              type="password"
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              error={errors.password}
              hint="At least 8 characters."
              maxLength={128}
            />
            <Field
              id="confirm"
              type="password"
              label="Confirm password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              error={errors.confirm}
              maxLength={128}
            />
          </div>

          <Button type="submit" className="w-full h-11" disabled={submitting || loading}>
            {submitting ? "Creating your café..." : "Create café"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
  error,
  hint,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  maxLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        required
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
