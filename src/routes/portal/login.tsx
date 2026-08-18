import { createFileRoute } from "@tanstack/react-router";
import { PortalLoginPage } from "@/features/portal/components/portal-login-page";

export const Route = createFileRoute("/portal/login")({
  head: () => ({
    meta: [
      { title: "Wholesale Portal — Sign In" },
      { name: "description", content: "Sign in to your wholesale customer portal." },
      { property: "og:title", content: "Wholesale Portal — Sign In" },
    ],
  }),
  component: PortalLoginPage,
});
