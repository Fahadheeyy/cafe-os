import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth-guard";
import { OwnerShell } from "@/components/owner-shell";
import { StockManager } from "@/components/stock-manager";

export const Route = createFileRoute("/owner/stock")({
  ssr: false,
  component: () => (
    <AuthGuard role="owner">
      <OwnerShell title="Stock">
        <StockManager canEdit />
      </OwnerShell>
    </AuthGuard>
  ),
});
