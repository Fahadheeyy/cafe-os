import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth-guard";
import { ChefShell } from "@/components/chef-shell";
import { RequestsView } from "@/components/requests-view";

export const Route = createFileRoute("/chef/requests")({
  ssr: false,
  component: () => (
    <AuthGuard role="chef">
      <ChefShell title="Purchase Requests">
        <RequestsView role="chef" />
      </ChefShell>
    </AuthGuard>
  ),
});
