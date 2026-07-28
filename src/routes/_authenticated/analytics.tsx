import { createFileRoute } from "@tanstack/react-router";

import { AnalyticsPage } from "@/features/analytics/components/analytics-page";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Just Sly Suite" },
      { name: "description", content: "Trends, forecasting and branch benchmarking." },
      { property: "og:title", content: "Analytics — Just Sly Suite" },
      { property: "og:description", content: "Trends, forecasting and branch benchmarking." },
    ],
  }),
  component: AnalyticsPage,
});
