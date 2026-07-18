import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/manager/")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/manager/dashboard" });
  },
});
