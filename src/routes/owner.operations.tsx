/**
 * Manager Operations (`/owner/operations`). Live floor view — active
 * tables, kitchen ticket status, one-tap billing (UPI/Cash) and print.
 */
import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "@/components/auth-guard";
import { OwnerShell } from "@/components/owner-shell";
import { FloorOps } from "@/components/floor-ops";

export const Route = createFileRoute("/owner/operations")({
  ssr: false,
  component: () => (
    <AuthGuard role="owner">
      <OwnerShell title="Operations">
        <FloorOps manageTablesHref="/owner/tables" />
      </OwnerShell>
    </AuthGuard>
  ),
});
