import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth-guard";
import { ChefShell } from "@/components/chef-shell";
import { WasteView } from "@/components/waste-view";

export const Route = createFileRoute("/chef/waste")({
  ssr: false,
  component: () => (
    <AuthGuard role="chef">
      <ChefShell title="Waste & Spoilage">
        <WasteView canRecord />
      </ChefShell>
    </AuthGuard>
  ),
});
