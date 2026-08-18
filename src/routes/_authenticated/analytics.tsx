import { createFileRoute } from "@tanstack/react-router";

import { AnalyticsDashboardPage } from "@/features/analytics/components/analytics-dashboard-page";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Just Sly Suite" },
      { name: "description", content: "Trends, forecasting and branch benchmarking." },
      { property: "og:title", content: "Analytics — Just Sly Suite text" },
      { property: "og:description", content: "Trends, forecasting and branch benchmarking." },
    ],
  }),
  component: AnalyticsDashboardPage,
});

