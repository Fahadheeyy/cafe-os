/**
 * Root redirect. Sends the visitor to the right place based on Supabase Auth:
 *   - not signed in       → /login
 *   - signed in, no biz   → /onboarding
 *   - signed in with role → their role's home dashboard
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, roleHome } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRedirect,
});

function IndexRedirect() {
  const { loading, session, profile, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
    } else if (!profile?.business_id) {
      navigate({ to: "/onboarding", replace: true });
    } else {
      navigate({ to: roleHome(role), replace: true });
    }
  }, [loading, session, profile?.business_id, role, navigate]);

  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
        aria-label="Loading"
      />
    </div>
  );
}
