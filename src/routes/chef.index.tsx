import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/chef/")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/chef/dashboard" });
  },
});
