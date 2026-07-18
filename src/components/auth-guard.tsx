/**
 * Client-side route guard backed by Supabase Auth.
 *
 * Rules:
 *  - No session → redirect to `/login`.
 *  - Session, but no business assigned yet → redirect to `/onboarding`.
 *  - Session with a mismatched role → redirect to that role's home.
 *  - While the auth context is still loading, render a full-page spinner
 *    (never flash protected content).
 */
import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth, roleHome, type Role } from "@/hooks/use-auth";

function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

export function AuthGuard({
  role,
  children,
}: {
  role: Role | Role[];
  children: ReactNode;
}) {
  const { session, profile, role: userRole, loading } = useAuth();
  const navigate = useNavigate();
  const roleKey = Array.isArray(role) ? role.join(",") : role;
  const roles = Array.isArray(role) ? role : [role];
  const allowed = !!session && !!profile?.business_id && !!userRole && roles.includes(userRole);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (!profile?.business_id) {
      navigate({ to: "/onboarding", replace: true });
      return;
    }
    if (userRole && !roles.includes(userRole)) {
      navigate({ to: roleHome(userRole), replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, profile?.business_id, userRole, roleKey, navigate]);

  if (loading) return <FullPageSpinner />;
  if (!allowed) return null;
  return <>{children}</>;
}
