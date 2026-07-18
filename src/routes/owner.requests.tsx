import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth-guard";
import { OwnerShell } from "@/components/owner-shell";
import { RequestsView } from "@/components/requests-view";

export const Route = createFileRoute("/owner/requests")({
  ssr: false,
  component: () => (
    <AuthGuard role="owner">
      <OwnerShell title="Purchase Requests">
        <RequestsView role="owner" />
      </OwnerShell>
    </AuthGuard>
  ),
});
