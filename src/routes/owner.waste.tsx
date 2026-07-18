import { WasteView } from "@/components/waste-view";
import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth-guard";
import { OwnerShell } from "@/components/owner-shell";

export const Route = createFileRoute("/owner/waste")({
  ssr: false,
  component: () => (
    <AuthGuard role="owner">
      <OwnerShell title="Waste & Spoilage">
        <WasteView canRecord />
      </OwnerShell>
    </AuthGuard>
  ),
});
