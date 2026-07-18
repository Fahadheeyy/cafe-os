import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth-guard";
import { ChefShell } from "@/components/chef-shell";
import { StockManager } from "@/components/stock-manager";

export const Route = createFileRoute("/chef/stock")({
  ssr: false,
  component: () => (
    <AuthGuard role="chef">
      <ChefShell title="Stock">
        <StockManager canEdit={false} />
      </ChefShell>
    </AuthGuard>
  ),
});
