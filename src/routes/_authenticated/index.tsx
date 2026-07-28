import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "@/features/dashboard/components/dashboard-page";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Just Sly Suite" },
      { name: "description", content: "Operational overview across every Just Sly branch." },
      { property: "og:title", content: "Dashboard — Just Sly Suite" },
      { property: "og:description", content: "Operational overview across every Just Sly branch." },
    ],
  }),
  component: DashboardPage,
});
